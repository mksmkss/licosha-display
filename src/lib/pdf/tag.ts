import { PDFDocument, rgb } from "pdf-lib";
import type { Plate } from "../excel";
import { wrapWords } from "../textwrap";
import { toPx, A4_PT } from "../units";
import { cardPosition, cardsPerPage, type GridLayout } from "./grid";
import { embedNotoSans } from "./fonts";

/**
 * Port of Tag/main.py `generate_tag_pdf` (name tags: title + penname).
 * The original used "Meiryo UI" (MeiryoUI-03.ttf, sans) → Noto Sans JP here.
 */

const LAYOUT: GridLayout = {
  cols: 2,
  rows: 5,
  cardWidth: toPx(105),
  cardHeight: toPx(59),
  marginX: 0,
  marginY: 0,
};

const TITLE_SIZE = 25;
const PENNAME_SIZE = 20;
const TITLE_WRAP_WIDTH = 10;
const BLACK = rgb(0, 0, 0);

export async function generateTagPdf(plates: Plate[]): Promise<Map<string, Uint8Array>> {
  const pages = new Map<string, Uint8Array>();
  const perPage = cardsPerPage(LAYOUT);
  const pageCount = Math.ceil(plates.length / perPage);

  for (let i = 0; i < pageCount; i++) {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4_PT);
    const font = await embedNotoSans(doc);

    const cardsOnPage = Math.min(perPage, plates.length - i * perPage);
    for (let slot = 0; slot < cardsOnPage; slot++) {
      const idx = i * perPage + slot;
      const plate = plates[idx];
      const { x, y } = cardPosition(LAYOUT, slot);
      const cardW = LAYOUT.cardWidth;
      const cardH = LAYOUT.cardHeight;

      page.drawRectangle({ x, y, width: cardW, height: cardH, borderColor: BLACK, borderWidth: 1 });

      const titleLines = wrapWords(plate.title, TITLE_WRAP_WIDTH);
      const xList: number[] = [];
      const yList: number[] = [];
      titleLines.forEach((line, k) => {
        const width = font.widthOfTextAtSize(line, TITLE_SIZE);
        xList.push(x + cardW / 2 - width / 2);
        yList.push(y + (cardH / 5) * 3 - TITLE_SIZE * k);
      });

      const pennameWidth = font.widthOfTextAtSize(plate.penname, PENNAME_SIZE);
      xList.push(x + cardW / 2 - pennameWidth / 2);
      yList.push(y + cardH / 5);

      titleLines.forEach((line, k) => {
        page.drawText(line, { x: xList[k], y: yList[k], size: TITLE_SIZE, font, color: BLACK });
      });
      page.drawText(plate.penname, {
        x: xList[titleLines.length],
        y: yList[titleLines.length],
        size: PENNAME_SIZE,
        font,
        color: BLACK,
      });
    }

    const bytes = await doc.save();
    pages.set(`tag_${i}.pdf`, bytes);
  }

  return pages;
}
