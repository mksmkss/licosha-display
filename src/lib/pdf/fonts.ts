import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

/**
 * Font mapping decisions (the original app registered a Japanese TTF per
 * PDF module, sometimes inconsistently across platforms — see each
 * pdf/*.ts file for the source mapping):
 *  - Integeration/main.py used the CID font "HeiseiMin-W3" (a Mincho/serif
 *    face) for the Caption PDF's title/penname/description.
 *  - Description/main.py used YUMIN.TTF (Yu Mincho, serif) on Mac but
 *    MeiryoUI-03.ttf (sans) on Windows for the Description PDF — we pick
 *    the Mac (serif) behavior since that's what the original had.
 *  - Tag/main.py and QRcode/main.py both used MeiryoUI-03.ttf (sans).
 * MeiryoUI-03.ttf / YUMIN.TTF are Microsoft-licensed and can't be
 * redistributed from this public repo, so both are replaced with the
 * closest freely-licensed equivalents: Noto Serif JP / Noto Sans JP.
 *
 * Noto Sans/Serif JP ship from Google as CFF-flavored OpenType (.otf), and
 * pdf-lib + fontkit cannot embed those correctly for a font this size: with
 * `subset: true` the resulting font is unparseable by other PDF readers,
 * and even unsubsetted the CID-keyed CFF glyph lookup resolves to the
 * wrong glyphs (Japanese text renders as unrelated symbols). Two build-time
 * workarounds avoid pdf-lib's runtime subsetting/CFF path entirely:
 *  1. Pre-subset to JIS X 0208 + Latin (`pyftsubset`) — full CJK coverage
 *     is unnecessary and bloats every generated PDF, since each is its own
 *     PDFDocument with its own font copy (see pdf/caption.ts etc).
 *  2. Convert CFF outlines to TrueType glyf outlines (`otf2ttf`) — fixes
 *     the glyph lookup corruption.
 * `embedFont` below always runs with `subset: false`, relying entirely on
 * this pre-subsetting. See assets/LICENSES.md for the exact commands.
 */
const FONT_URLS = {
  sans: `${import.meta.env.BASE_URL}assets/fonts/NotoSansJP-Regular.ttf`,
  serif: `${import.meta.env.BASE_URL}assets/fonts/NotoSerifJP-Regular.ttf`,
} as const;

const fontBytesCache = new Map<string, Promise<ArrayBuffer>>();

function fetchFontBytes(url: string): Promise<ArrayBuffer> {
  let cached = fontBytesCache.get(url);
  if (!cached) {
    cached = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed to load font: ${url}`);
      return res.arrayBuffer();
    });
    fontBytesCache.set(url, cached);
  }
  return cached;
}

export async function embedNotoSans(doc: PDFDocument): Promise<PDFFont> {
  doc.registerFontkit(fontkit);
  const bytes = await fetchFontBytes(FONT_URLS.sans);
  return doc.embedFont(bytes, { subset: false });
}

export async function embedNotoSerif(doc: PDFDocument): Promise<PDFFont> {
  doc.registerFontkit(fontkit);
  const bytes = await fetchFontBytes(FONT_URLS.serif);
  return doc.embedFont(bytes, { subset: false });
}
