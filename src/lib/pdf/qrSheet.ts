import { PDFDocument, rgb } from "pdf-lib";
import type { SnsKind } from "../excel";
import { generateQrCanvas } from "../qr";
import { canvasToPngBytes } from "../canvasUtils";
import { toPx, A4_PT } from "../units";
import { hexColor } from "./colors";
import { cardPosition, cardsPerPage, type GridLayout } from "./grid";
import { embedNotoSans } from "./fonts";
import { PngImageCache } from "./imageCache";

/**
 * Port of QRcode/main.py `generate_qr_pdf` (a reference sheet of every
 * Instagram/X QR code, "colored blue" themed). "Meiryo UI" → Noto Sans JP.
 *
 * Note: the original Python computed the per-page data offset as `10*i`
 * even though this grid has `4*5=20` cards per page (copy-pasted from the
 * 10-per-page Tag/Caption grids), which duplicates entries across pages
 * once there are more than 20 SNS accounts. That's an implementation
 * defect rather than intentional behavior, so this port derives the offset
 * from the actual per-page card count instead of reproducing it.
 *
 * Also note: in the original app, these "colored blue" QR PNGs are written
 * to the same `QRcode/<sns>_<id>.png` paths that Integeration's Caption
 * PDF generation writes its "mono white" QR PNGs to — and since
 * `generate_qr_pdf` always runs after Caption generation in `gui_2.py`,
 * its files win. That overwrite ordering is replicated at the call site
 * (zip.ts), not here.
 */

const LAYOUT: GridLayout = {
  cols: 4,
  rows: 5,
  cardWidth: toPx(50),
  cardHeight: toPx(50),
  marginX: 0,
  marginY: 0,
};

const ID_FONT_SIZE = 10;
const ID_COLOR = hexColor("#16537B"); // matches the "colored blue" theme's color1

function sanitizeFilename(name: string): string {
  return name.replace(/\//g, "-");
}

export interface QrSheetResult {
  pages: Map<string, Uint8Array>;
  qrImages: Map<string, Uint8Array>;
}

export async function generateQrSheetPdf(
  idList: [string, SnsKind][],
  assets: { instagramSvg: string; xSvg: string },
): Promise<QrSheetResult> {
  const pages = new Map<string, Uint8Array>();
  const qrImages = new Map<string, Uint8Array>();
  const qrPngCache = new Map<string, Uint8Array>();

  const perPage = cardsPerPage(LAYOUT);
  const pageCount = Math.ceil(idList.length / perPage);

  for (let i = 0; i < pageCount; i++) {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4_PT);
    const font = await embedNotoSans(doc);
    const imageCache = new PngImageCache(doc);

    const cardsOnPage = Math.min(perPage, idList.length - i * perPage);
    for (let slot = 0; slot < cardsOnPage; slot++) {
      const idx = i * perPage + slot;
      const [id, sns] = idList[idx];
      const { x, y } = cardPosition(LAYOUT, slot);
      const cardW = LAYOUT.cardWidth;
      const cardH = LAYOUT.cardHeight;

      page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: rgb(0, 0, 0), borderWidth: 1 });

      const qrLink = sns === "instagram" ? `https://www.instagram.com/${id}?utm_source=qr` : `https://x.com/${id}`;
      const cacheKey = `qr:${sns}:${id}`;
      let pngBytes = qrPngCache.get(cacheKey);
      if (!pngBytes) {
        const logoSvg = sns === "instagram" ? assets.instagramSvg : assets.xSvg;
        const canvas = await generateQrCanvas(qrLink, { theme: "colored blue", logoSvg, version: 8 });
        pngBytes = await canvasToPngBytes(canvas);
        qrPngCache.set(cacheKey, pngBytes);
        qrImages.set(`${sns}_${sanitizeFilename(id)}.png`, pngBytes);
      }
      const embedded = await imageCache.get(cacheKey, pngBytes);
      page.drawImage(embedded, {
        x: x + cardW / 2 - 55,
        y: y + cardH / 6,
        width: 110,
        height: 110,
      });

      const idWidth = font.widthOfTextAtSize(id, ID_FONT_SIZE);
      page.drawText(id, { x: x + cardW / 2 - idWidth / 2, y: y + 10, size: ID_FONT_SIZE, font, color: ID_COLOR });
    }

    const bytes = await doc.save();
    pages.set(`qr_${i}.pdf`, bytes);
  }

  return { pages, qrImages };
}
