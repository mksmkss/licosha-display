/**
 * Simplified port of Python's `textwrap.wrap(text, width)` with its default
 * `break_long_words=True` behavior — greedy whitespace word-wrap, force-
 * breaking any single "word" longer than `width` into multiple chunks.
 * Used directly for title/description wrapping in Tag/Description PDFs
 * (whose Japanese source strings have no spaces, so this degenerates to
 * fixed-width chunking — matching the Python original's behavior on the
 * same input), and as budoux.ts's non-Japanese fallback.
 */
export function wrapWords(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    let remaining = word;
    while (remaining.length > width) {
      if (line.length > 0) {
        lines.push(line);
        line = "";
      }
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    const candidate = line.length === 0 ? remaining : `${line} ${remaining}`;
    if (candidate.length <= width) {
      line = candidate;
    } else {
      if (line.length > 0) lines.push(line);
      line = remaining;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}
