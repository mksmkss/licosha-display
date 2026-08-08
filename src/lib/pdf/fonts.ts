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
 * Noto Sans/Serif JP ship from Google as CFF-flavored OpenType (.otf).
 * Getting these to embed correctly via pdf-lib + fontkit took three
 * build-time workarounds (see assets/LICENSES.md for the exact commands):
 *  1. Pre-subset to JIS X 0208 + Latin (`pyftsubset`) — full CJK coverage
 *     is unnecessary and bloats every generated PDF, since each is its own
 *     PDFDocument with its own font copy (see pdf/caption.ts etc).
 *  2. Convert CFF outlines to TrueType glyf outlines (`otf2ttf`) — without
 *     this, `subset: true` produces a font unparseable by other PDF
 *     readers, and even unsubsetted the CID-keyed CFF glyph lookup
 *     resolves to the wrong glyphs (Japanese text renders as symbols).
 *  3. Strip GSUB/GPOS layout tables (`pyftsubset --layout-features=''`).
 *     Without this, digits and some Latin runs render with huge gaps
 *     between characters: pdf-lib's `CustomFontEmbedder` computes the
 *     glyph IDs it writes into the PDF content stream via fontkit's
 *     *contextually-shaped* `font.layout()` (which — via this font's GSUB
 *     ccmp/liga lookups — can substitute a different glyph ID for the same
 *     character depending on surrounding text), but computes the PDF's
 *     glyph width table (/W) via plain per-codepoint `glyphForCodePoint()`
 *     lookups. Those two glyph-ID sources disagree for any character a
 *     GSUB rule touches, so the shaped glyph ends up with no /W entry and
 *     falls back to the PDF spec's default width (1000 units/em) instead
 *     of its real (~555) advance. This app only ever draws plain text
 *     labels — no ligatures or contextual forms are needed — so dropping
 *     GSUB/GPOS entirely sidesteps the mismatch instead of patching
 *     pdf-lib itself.
 * `embedFont` below always runs with `subset: false`, relying entirely on
 * this pre-subsetting.
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
