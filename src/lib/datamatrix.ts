import bwipjs from "bwip-js";
import { createCanvas } from "./canvasUtils";

/**
 * Port of Integeration/functions.py `generate_data_matrix`. The Python
 * version encodes with pylibdmtx (fixed `size x size` module grid) then
 * manually recolors the raw black/white pixels to #2c2c2e/white. bwip-js
 * renders directly in the target colors via `barcolor`/`backgroundcolor`
 * (no post-processing needed) and auto-sizes the module grid to fit the
 * text instead of forcing a fixed module count — functionally equivalent
 * for scanning, since the encoded UUID is what matters, not the exact
 * symbol dimensions.
 */
export function generateDataMatrixCanvas(data: string, pixelsPerModule = 10): HTMLCanvasElement {
  const canvas = createCanvas(1, 1); // bwip-js resizes the canvas itself
  bwipjs.toCanvas(canvas, {
    bcid: "datamatrix",
    text: data,
    scale: pixelsPerModule,
    barcolor: "2c2c2e",
    backgroundcolor: "ffffff",
    includetext: false,
  });
  return canvas;
}
