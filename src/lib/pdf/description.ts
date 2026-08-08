import { PDFDocument, rgb } from "pdf-lib";
import { wrapWords } from "../textwrap";
import { toPx, A4_PT } from "../units";
import { cardPosition, cardsPerPage, type GridLayout } from "./grid";
import { embedNotoSerif } from "./fonts";

/**
 * Port of Description/main.py `generate_description_pdf` (a plain grid of
 * description text, unrelated to any particular title/penname). The
 * original registered "usefont" from YUMIN.TTF (Yu Mincho, serif) on Mac
 * but MeiryoUI-03.ttf (sans) on Windows — an existing platform
 * inconsistency in the app; this port follows the Mac behavior and maps to
 * Noto Serif JP.
 */

const LAYOUT: GridLayout = {
  cols: 2,
  rows: 5,
  cardWidth: toPx(105),
  cardHeight: toPx(59),
  marginX: 0,
  marginY: 0,
};

const FONT_SIZE = 16;
const WRAP_WIDTH = 16;
const BLACK = rgb(0, 0, 0);

export async function generateDescriptionPdf(descriptions: string[]): Promise<Map<string, Uint8Array>> {
  const pages = new Map<string, Uint8Array>();
  const perPage = cardsPerPage(LAYOUT);
  const pageCount = Math.ceil(descriptions.length / perPage);

  for (let i = 0; i < pageCount; i++) {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4_PT);
    const font = await embedNotoSerif(doc);

    const cardsOnPage = Math.min(perPage, descriptions.length - i * perPage);
    for (let slot = 0; slot < cardsOnPage; slot++) {
      const idx = i * perPage + slot;
      const description = descriptions[idx];
      const { x, y } = cardPosition(LAYOUT, slot);
      const cardW = LAYOUT.cardWidth;
      const cardH = LAYOUT.cardHeight;

      page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: BLACK, borderWidth: 1 });

      const lines = wrapWords(description, WRAP_WIDTH);
      lines.forEach((line, k) => {
        const width = font.widthOfTextAtSize(line, FONT_SIZE);
        const lineX = x + cardW / 2 - width / 2;
        const lineY = y + cardH / 2 + 12.5 * (lines.length - 2) - FONT_SIZE * k;
        page.drawText(line, { x: lineX, y: lineY, size: FONT_SIZE, font, color: BLACK });
      });
    }

    const bytes = await doc.save();
    pages.set(`description_${i}.pdf`, bytes);
  }

  return pages;
}
