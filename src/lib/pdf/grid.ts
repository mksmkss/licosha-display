export interface GridLayout {
  cols: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  marginX: number;
  marginY: number;
}

export function cardsPerPage(layout: GridLayout): number {
  return layout.cols * layout.rows;
}

/** Position (bottom-left corner) of the `slot`-th card on its page, 0-indexed, row-major, bottom row first. */
export function cardPosition(layout: GridLayout, slot: number): { x: number; y: number } {
  const col = slot % layout.cols;
  const row = Math.floor(slot / layout.cols);
  return {
    x: layout.marginX + col * layout.cardWidth,
    y: layout.marginY + row * layout.cardHeight,
  };
}
