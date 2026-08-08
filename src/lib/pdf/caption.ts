import { PDFDocument, rgb } from "pdf-lib";
import type { Plate, SnsKind } from "../excel";
import { wrapDescription } from "../budoux";
import { generateQrCanvas } from "../qr";
import { generateDataMatrixCanvas } from "../datamatrix";
import { canvasToPngBytes, svgToPngBytes } from "../canvasUtils";
import { toPx, A4_PT } from "../units";
import { CAPTION_INK, CAPTION_PENNAME_TEXT } from "./colors";
import { cardPosition, cardsPerPage, type GridLayout } from "./grid";
import { embedNotoSerif } from "./fonts";
import { PngImageCache } from "./imageCache";

/**
 * Port of Integeration/main.py `generate_caption_pdf` — the main Caption
 * PDF (title / penname / description card per work, with SNS QR codes, an
 * optional DataMatrix, and a "no photography" icon). The original used the
 * reportlab CID font "HeiseiMin-W3" (a Mincho/serif face) for all of the
 * card text; here that maps to Noto Serif JP (see pdf/fonts.ts).
 */

const LAYOUT: GridLayout = {
  cols: 2,
  rows: 5,
  cardWidth: toPx(105),
  cardHeight: toPx(59),
  marginX: 0,
  marginY: 0,
};

const TITLE_SIZE = 16;
const PENNAME_SIZE = 13;
const DESCRIPTION_SIZE = 12;
const RECT_HEIGHT_MM = 14;
const NOTAKING_WIDTH_MM = 12;
const DATA_MATRIX_WIDTH_MM = 18;
const DESCRIPTION_MAX_LEN = 18;
/** Matches the original app's fixed size (rect_height - 2mm). */
export const DEFAULT_SNS_QR_SIZE_MM = RECT_HEIGHT_MM - 2;
/** Horizontal gap between consecutive SNS QR codes on the same card. */
const SNS_QR_GAP_MM = 3;

function sanitizeFilename(name: string): string {
  return name.replace(/\//g, "-");
}

export interface CaptionAssets {
  instagramSvg: string;
  xSvg: string;
  cameraOffSvg: string;
}

export interface CaptionPdfParams {
  plates: Plate[];
  descriptions: string[];
  idsDict: Record<string, [string, SnsKind][]>;
  permissionDict: Record<string, string>;
  uuids: string[];
  showDataMatrix: boolean;
  assets: CaptionAssets;
  /** Size (mm, square) of each SNS QR code drawn in a card's dark bar. */
  snsQrSizeMm?: number;
}

export interface CaptionPdfResult {
  /** "caption_0.pdf" -> bytes, one entry per generated A4 sheet. */
  pages: Map<string, Uint8Array>;
  /** "instagram_handle.png" -> bytes, for the QRcode/ output folder. */
  qrImages: Map<string, Uint8Array>;
  /** "penname_title.png" -> bytes, for the Data Matrix/ output folder. */
  dataMatrixImages: Map<string, Uint8Array>;
}

export async function generateCaptionPdf(params: CaptionPdfParams): Promise<CaptionPdfResult> {
  const {
    plates,
    descriptions,
    idsDict,
    permissionDict,
    uuids,
    showDataMatrix,
    assets,
    snsQrSizeMm = DEFAULT_SNS_QR_SIZE_MM,
  } = params;

  const pages = new Map<string, Uint8Array>();
  const qrImages = new Map<string, Uint8Array>();
  const dataMatrixImages = new Map<string, Uint8Array>();

  const qrPngCache = new Map<string, Uint8Array>();
  const dmPngCache = new Map<string, Uint8Array>();
  let noCameraPngBytes: Uint8Array | null = null;

  const perPage = cardsPerPage(LAYOUT);
  const pageCount = Math.ceil(plates.length / perPage);

  for (let i = 0; i < pageCount; i++) {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4_PT);
    const font = await embedNotoSerif(doc);
    const imageCache = new PngImageCache(doc);

    const cardsOnPage = Math.min(perPage, plates.length - i * perPage);
    for (let slot = 0; slot < cardsOnPage; slot++) {
      const idx = i * perPage + slot;
      const plate = plates[idx];
      const description = descriptions[idx] ?? "";
      const uuid = uuids[idx] ?? "";
      const { x, y } = cardPosition(LAYOUT, slot);
      const cardW = LAYOUT.cardWidth;
      const cardH = LAYOUT.cardHeight;

      page.drawRectangle({
        x,
        y,
        width: cardW,
        height: cardH,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      page.drawRectangle({
        x,
        y,
        width: cardW,
        height: toPx(RECT_HEIGHT_MM),
        color: CAPTION_INK,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      const descriptionLines = wrapDescription(description, DESCRIPTION_MAX_LEN);

      const titleX = x + cardW * 0.08;
      const titleY = y + cardH * 0.8;
      page.drawText(plate.title, { x: titleX, y: titleY, size: TITLE_SIZE, font, color: CAPTION_INK });

      const pennameWidth = font.widthOfTextAtSize(plate.penname, PENNAME_SIZE);
      const pennameX = x + cardW - cardW * 0.08 - pennameWidth;
      const pennameY = y + toPx(RECT_HEIGHT_MM) / 2 - PENNAME_SIZE / 2 + 2;
      page.drawText(plate.penname, {
        x: pennameX,
        y: pennameY,
        size: PENNAME_SIZE,
        font,
        color: CAPTION_PENNAME_TEXT,
      });

      const descX = x + cardW * 0.15;
      descriptionLines.forEach((line, k) => {
        const descY =
          y + cardH / 2 + (DESCRIPTION_SIZE / 2) * (descriptionLines.length - 2) - DESCRIPTION_SIZE * k - 5;
        page.drawText(line, { x: descX, y: descY, size: DESCRIPTION_SIZE, font, color: CAPTION_INK });
      });

      const snsList = idsDict[plate.penname] ?? [];
      for (let l = 0; l < snsList.length; l++) {
        const [id, sns] = snsList[l];
        const qrLink =
          sns === "instagram" ? `https://www.instagram.com/${id}?utm_source=qr` : `https://x.com/${id}`;
        const cacheKey = `qr:${sns}:${id}`;
        let pngBytes = qrPngCache.get(cacheKey);
        if (!pngBytes) {
          const logoSvg = sns === "instagram" ? assets.instagramSvg : assets.xSvg;
          const canvas = await generateQrCanvas(qrLink, { theme: "mono white", logoSvg, version: 8 });
          pngBytes = await canvasToPngBytes(canvas);
          qrPngCache.set(cacheKey, pngBytes);
          qrImages.set(`${sns}_${sanitizeFilename(id)}.png`, pngBytes);
        }
        const embedded = await imageCache.get(cacheKey, pngBytes);
        const qrSize = toPx(snsQrSizeMm);
        page.drawImage(embedded, {
          x: x + l * toPx(snsQrSizeMm + SNS_QR_GAP_MM) + toPx(9),
          y: y + (toPx(RECT_HEIGHT_MM) - qrSize) / 2,
          width: qrSize,
          height: qrSize,
        });
      }

      if (showDataMatrix) {
        const dmFilename = `${sanitizeFilename(plate.penname)}_${sanitizeFilename(plate.title)}.png`;
        const cacheKey = `dm:${uuid}`;
        let pngBytes = dmPngCache.get(cacheKey);
        if (!pngBytes) {
          const canvas = generateDataMatrixCanvas(uuid);
          pngBytes = await canvasToPngBytes(canvas);
          dmPngCache.set(cacheKey, pngBytes);
        }
        dataMatrixImages.set(dmFilename, pngBytes);
        const embedded = await imageCache.get(cacheKey, pngBytes);
        const dmSize = toPx(DATA_MATRIX_WIDTH_MM);
        page.drawImage(embedded, {
          x: x + cardW - cardW * 0.08 - dmSize,
          y: y + cardH * 0.95 - dmSize,
          width: dmSize,
          height: dmSize,
        });
      }

      if (permissionDict[plate.penname] === "No") {
        if (!noCameraPngBytes) {
          noCameraPngBytes = await svgToPngBytes(assets.cameraOffSvg, "#2c2c2e", 200);
        }
        const embedded = await imageCache.get("icon:no-camera", noCameraPngBytes);
        const iconSize = toPx(NOTAKING_WIDTH_MM);
        // The x offset always reserves DataMatrix-width of space, matching the
        // original layout even when show_datamatrix is off.
        const dmReserve = toPx(DATA_MATRIX_WIDTH_MM);
        page.drawImage(embedded, {
          x: x + cardW - cardW * 0.08 - iconSize - 4 - dmReserve,
          y: y + cardH * 0.95 - iconSize,
          width: iconSize,
          height: iconSize,
        });
      }
    }

    const bytes = await doc.save();
    pages.set(`caption_${i}.pdf`, bytes);
  }

  return { pages, qrImages, dataMatrixImages };
}
