const segmenter = new Intl.Segmenter("tr", { granularity: "grapheme" });
const encoder = new TextEncoder();

/**
 * Truncates to a limit without splitting a grapheme (so no broken emoji or
 * combining marks), appending an ellipsis when cut. `measure` decides the unit:
 * Meta limits message text in UTF-8 bytes but template fields in characters.
 */
function truncateBy(text: string, limit: number, measure: (s: string) => number): string {
  if (measure(text) <= limit) return text;
  const ellipsis = "…";
  const budget = limit - measure(ellipsis);
  let out = "";
  for (const { segment } of segmenter.segment(text)) {
    if (measure(out + segment) > budget) break;
    out += segment;
  }
  return out.trimEnd() + ellipsis;
}

const graphemes = (s: string) => [...segmenter.segment(s)].length;
const utf8Bytes = (s: string) => encoder.encode(s).length;

export const truncateGraphemes = (text: string, max: number) => truncateBy(text, max, graphemes);
export const truncateUtf8 = (text: string, maxBytes: number) => truncateBy(text, maxBytes, utf8Bytes);
