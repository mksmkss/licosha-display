import { rgb, type RGB } from "pdf-lib";

export function hexColor(hex: string): RGB {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export const CAPTION_INK = hexColor("#2c2c2e");
export const CAPTION_PENNAME_TEXT = rgb(237 / 255, 237 / 255, 235 / 255);
