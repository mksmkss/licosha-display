/** PDF points per millimeter (72pt / 25.4mm), matching reportlab's `mm` unit. */
export const PT_PER_MM = 72 / 25.4;

export function toPx(mm: number): number {
  return mm * PT_PER_MM;
}

export function toMm(px: number): number {
  return px / PT_PER_MM;
}

/** A4 page size in points, matching reportlab.lib.pagesizes.A4. */
export const A4_PT: [number, number] = [toPx(210), toPx(297)];
