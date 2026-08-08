import qrcodegen from "qrcode-generator";
import { createCanvas, get2dContext, fillEllipseBox, fillRectBox, loadColoredSvgImage } from "./canvasUtils";

/**
 * Port of qrcode_generate.py's `QRGenerator` — a hand-rolled QR renderer
 * that draws each dark module as a rounded blob (instead of a plain
 * square), reserves a hole in the middle for a logo, and replaces the
 * three finder patterns with a custom concentric "eye" design.
 *
 * Only the two themes actually used by the app are ported faithfully from
 * Integeration/qrcode_generate.py (the Python app has two near-duplicate
 * copies of this file — Integeration's and QRcode's — whose "mono dark"/
 * "mono white" theme colors drifted apart over time; "colored blue" is
 * identical in both, and "mono white" is only ever used via Integeration's
 * copy, so that's the definition ported here).
 */
export type QrTheme = "colored light" | "colored dark" | "colored blue" | "mono dark" | "mono white";

interface ThemeColors {
  color1: string;
  color2: string;
  color3: string;
  wallpaper: string;
}

function themeColors(theme: QrTheme): ThemeColors {
  switch (theme) {
    case "colored light":
      return { color1: "#517BD6", color2: "#51A8D6", color3: "#5192D6", wallpaper: "white" };
    case "colored dark":
      return { color1: "#ff8051", color2: "#c0693c", color3: "#ff9a51", wallpaper: "black" };
    case "colored blue":
      return { color1: "#0F3A57", color2: "#124668", color3: "#16537B", wallpaper: "white" };
    case "mono dark":
      return { color1: "white", color2: "white", color3: "white", wallpaper: "#2c2c2e" };
    case "mono white":
      return { color1: "#2c2c2e", color2: "#2c2c2e", color3: "#2c2c2e", wallpaper: "white" };
  }
}

// Capacity thresholds used to auto-pick a version (byte-mode, ported verbatim).
const CAPACITY_BY_VERSION = [
  8, 15, 25, 35, 45, 59, 65, 85, 99, 121, 139, 157, 179, 196, 222, 252, 282, 312, 340, 384, 405,
  441, 463, 513, 537, 595, 627, 660, 700, 744, 792, 844, 900, 960, 985, 1053, 1095, 1141, 1221,
  1275,
];

function resolveVersion(text: string, explicitVersion?: number): number {
  const length = text.length;
  const maxCapacity = CAPACITY_BY_VERSION[CAPACITY_BY_VERSION.length - 1];
  if (maxCapacity < length) {
    throw new Error(`Text length must be lower by "${maxCapacity - 1}"`);
  }
  let minVersion = 0;
  for (let i = 0; i < CAPACITY_BY_VERSION.length; i++) {
    if (CAPACITY_BY_VERSION[i] > length) {
      minVersion = i + 1;
      break;
    }
  }
  const version = explicitVersion ?? Math.max(minVersion, 5);
  if (minVersion > version) {
    throw new Error(`Not encode QR-code with version=${version}`);
  }
  return version;
}

function buildModuleMatrix(text: string, version: number): boolean[][] {
  const qr = qrcodegen(version as Parameters<typeof qrcodegen>[0], "H");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let y = 0; y < count; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < count; x++) row.push(qr.isDark(y, x));
    matrix.push(row);
  }
  return matrix;
}

function drawModules(ctx: CanvasRenderingContext2D, matrix: boolean[][], count: number, color3: string): void {
  const midLow = Math.floor(count / 3) - 1;
  const midHigh = count - Math.floor(count / 3);

  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (!matrix[y][x]) continue;

      let worked = true;
      let end = false;
      let start = false;

      if (midLow < y && y < midHigh) {
        if (x === midLow) end = true;
        if (x === midHigh) start = true;
        if (midLow < x && x < midHigh) worked = false;
      }
      if (!end) end = x + 1 < count ? !matrix[y][x + 1] : true;
      if (!start) start = x > 0 ? !matrix[y][x - 1] : true;
      if (!worked) continue;

      const x0 = 10 + 10 * x;
      const y0 = 10 + 10 * y;
      const x1 = 20 + 10 * x;
      const y1 = 20 + 10 * y;

      if (end) {
        fillEllipseBox(ctx, x0, y0, x1, y1, color3);
        if (!start) fillRectBox(ctx, x0, y0, x0 + 5, y1, color3);
      } else if (start) {
        fillEllipseBox(ctx, x0, y0, x1, y1, color3);
        if (!end) fillRectBox(ctx, x0 + 5, y0, x1, y1, color3);
      } else {
        fillRectBox(ctx, x0, y0, x1, y1, color3);
      }
    }
  }
}

function drawFinderPatterns(
  ctx: CanvasRenderingContext2D,
  count: number,
  colors: Pick<ThemeColors, "color1" | "color2" | "wallpaper">,
): void {
  const { color1, color2, wallpaper } = colors;

  // Erase the dotty module rendering underneath each finder pattern first.
  fillRectBox(ctx, 10, 10, 80, 80, wallpaper);
  fillRectBox(ctx, 10, 10, 70, 70, wallpaper);
  fillRectBox(ctx, (count - 7) * 10 + 10, 10, count * 10 + 10, 80, wallpaper);
  fillRectBox(ctx, 10, (count - 7) * 10 + 10, 80, count * 10 + 10, wallpaper);

  const starts: Array<[number, number]> = [
    [0, 0],
    [(count - 7) * 10, 0],
    [0, (count - 7) * 10],
  ];

  for (const [sx, sy] of starts) {
    fillEllipseBox(ctx, sx + 10, sy + 10, sx + 50, sy + 50, color1);
    fillEllipseBox(ctx, sx + 20, sy + 20, sx + 40, sy + 40, wallpaper);
    fillEllipseBox(ctx, sx + 40, sy + 40, sx + 80, sy + 80, color1);
    fillEllipseBox(ctx, sx + 50, sy + 50, sx + 70, sy + 70, wallpaper);
    fillEllipseBox(ctx, sx + 10, sy + 40, sx + 50, sy + 80, color1);
    fillEllipseBox(ctx, sx + 20, sy + 50, sx + 40, sy + 70, wallpaper);
    fillEllipseBox(ctx, sx + 40, sy + 10, sx + 80, sy + 50, color1);
    fillEllipseBox(ctx, sx + 50, sy + 20, sx + 70, sy + 40, wallpaper);

    fillRectBox(ctx, sx + 30, sy + 10, sx + 60, sy + 80, wallpaper);
    fillRectBox(ctx, sx + 10, sy + 30, sx + 80, sy + 60, wallpaper);

    fillRectBox(ctx, sx + 30, sy + 10, sx + 60, sy + 19, color1);
    fillRectBox(ctx, sx + 10, sy + 30, sx + 19, sy + 60, color1);
    fillRectBox(ctx, sx + 71, sy + 30, sx + 80, sy + 61, color1);
    fillRectBox(ctx, sx + 30, sy + 71, sx + 61, sy + 80, color1);

    fillEllipseBox(ctx, sx + 30, sy + 30, sx + 45, sy + 45, color2);
    fillEllipseBox(ctx, sx + 30, sy + 45, sx + 45, sy + 60, color2);
    fillEllipseBox(ctx, sx + 45, sy + 30, sx + 60, sy + 45, color2);
    fillEllipseBox(ctx, sx + 45, sy + 45, sx + 60, sy + 60, color2);

    fillRectBox(ctx, sx + 35, sy + 30, sx + 55, sy + 59, color2);
    fillRectBox(ctx, sx + 30, sy + 35, sx + 59, sy + 55, color2);
  }
}

export interface QrOptions {
  theme: QrTheme;
  /** Raw SVG source of the logo to composite in the center hole. */
  logoSvg: string;
  version?: number;
}

export async function generateQrCanvas(url: string, opts: QrOptions): Promise<HTMLCanvasElement> {
  const version = resolveVersion(url, opts.version);
  const matrix = buildModuleMatrix(url, version);
  const count = matrix.length;
  const colors = themeColors(opts.theme);

  const size = 20 + 10 * count;
  const canvas = createCanvas(size, size);
  const ctx = get2dContext(canvas);
  ctx.fillStyle = colors.wallpaper;
  ctx.fillRect(0, 0, size, size);

  drawModules(ctx, matrix, count, colors.color3);

  const logoWidth = 10 * (Math.floor(count / 3) + (count % 3)) - 4;
  const logoColor = colors.wallpaper === "white" ? colors.color3 : colors.wallpaper;
  const logoImage = await loadColoredSvgImage(opts.logoSvg, logoColor, logoWidth);
  const logoTopLeft = count * 5 + 10 - Math.floor(logoWidth / 2);
  ctx.drawImage(logoImage, logoTopLeft, logoTopLeft, logoWidth, logoWidth);

  drawFinderPatterns(ctx, count, colors);

  return canvas;
}
