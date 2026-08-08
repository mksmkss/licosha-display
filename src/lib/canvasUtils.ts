/** Shared canvas helpers used by qr.ts and datamatrix.ts. */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  return ctx;
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to encode canvas as PNG");
  return new Uint8Array(await blob.arrayBuffer());
}

/** PIL-style inclusive bounding-box ellipse fill: (x0,y0,x1,y1). */
export function fillEllipseBox(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x0 + rx, y0 + ry, Math.max(rx, 0), Math.max(ry, 0), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** PIL-style inclusive bounding-box rectangle fill: (x0,y0,x1,y1). */
export function fillRectBox(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/**
 * Rasterizes an SVG (recolored to `color`) onto a `size`x`size`
 * HTMLImageElement. Handles both fill-based icon sets (e.g. Simple Icons —
 * `fill` is an inherited SVG attribute, so setting it on the root element
 * colors child `<path>`s with no explicit fill) and stroke-based sets that
 * use `currentColor` (e.g. Lucide).
 */
export async function loadColoredSvgImage(
  svgText: string,
  color: string,
  size: number,
): Promise<HTMLImageElement> {
  const colored = svgText
    .replace("<svg ", `<svg width="${size}" height="${size}" fill="${color}" stroke="${color}" `)
    .replace(/currentColor/g, color);
  const blob = new Blob([colored], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.width = size;
    image.height = size;
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize SVG"));
    });
    image.src = url;
    return await loaded;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Rasterizes an SVG (recolored to `color`) directly to flat PNG bytes. */
export async function svgToPngBytes(svgText: string, color: string, size: number): Promise<Uint8Array> {
  const image = await loadColoredSvgImage(svgText, color, size);
  const canvas = createCanvas(size, size);
  const ctx = get2dContext(canvas);
  ctx.drawImage(image, 0, 0, size, size);
  return canvasToPngBytes(canvas);
}
