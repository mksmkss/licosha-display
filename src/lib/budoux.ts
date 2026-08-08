import { loadDefaultJapaneseParser } from "budoux";
import { wrapWords } from "./textwrap";

const parser = loadDefaultJapaneseParser();

/**
 * Port of the description line-wrapping logic embedded in
 * Integeration/main.py `generate_caption_pdf`: run budoux's Japanese parser
 * to find natural break points, then greedily pack chunks into lines of at
 * most `maxLen` characters. Falls back to whitespace word-wrap when budoux
 * produces no usable chunks (i.e. the description isn't Japanese text).
 */
export function wrapDescription(description: string, maxLen = 18): string[] {
  const chunks = parser.parse(description);
  const lines: string[] = [];
  let length = 0;
  let line = "";

  for (const chunk of chunks) {
    if (length + chunk.length <= maxLen) {
      line += chunk;
      length += chunk.length;
    } else {
      lines.push(line);
      line = chunk;
      length = chunk.length;
    }
  }
  lines.push(line);

  if (lines[0] === "") {
    return wrapWords(description, 40);
  }
  return lines;
}
