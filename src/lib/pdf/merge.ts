import { PDFDocument } from "pdf-lib";

/**
 * Port of Manupulate_PDF/main.py `merge_pdfs`. Only ever called on the
 * Caption PDF page set in the original app (`gui_2.py`'s `Process()`).
 *
 * Note: the Python original sorts filenames with `sorted(glob.glob(...))`,
 * which is a plain lexicographic string sort — "caption_10.pdf" sorts
 * before "caption_2.pdf". `Array.prototype.sort()` on strings does the
 * same, so this port reproduces that ordering "for free" without any
 * special-casing (both apps mis-order beyond ~10 pages identically).
 */
export async function mergePdfs(pages: Map<string, Uint8Array>): Promise<Uint8Array> {
  const sortedNames = [...pages.keys()].sort();
  const merged = await PDFDocument.create();

  for (const name of sortedNames) {
    const bytes = pages.get(name);
    if (!bytes) continue;
    const src = await PDFDocument.load(bytes);
    const copiedPages = await merged.copyPages(src, src.getPageIndices());
    for (const copiedPage of copiedPages) merged.addPage(copiedPage);
  }

  return merged.save();
}
