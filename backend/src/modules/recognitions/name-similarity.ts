/**
 * How alike two venue names are, in any script.
 *
 * The model names a venue the way the post does ("Sofyalı", "MAC&CHEESE"); Google names
 * it the way its listing does ("Sofyalı 9", "Mac and Cheese Istanbul"). Both are
 * normalised to plain lower-case letters and digits — NFKD with the marks stripped, so
 * "Café" meets "cafe" and "Göktürk" meets "gokturk" — then compared two ways:
 *
 * - token containment: the share of the shorter name's words found in the longer one,
 *   which is what a listing that appends a district or a "Coffee Roastery" looks like;
 * - character-bigram Dice, which needs no word boundaries and so carries scripts such
 *   as Japanese or Thai where spaces are rare.
 *
 * The score is the higher of the two. Turkish is the one language whose case mapping
 * is not Unicode's default (İ ↔ i, I ↔ ı), and a post and a listing often disagree on
 * which I they use ("Istanbul" / "İstanbul"), so all four collapse to a plain i first.
 */

const MARKS = /\p{M}+/gu;
const NOT_WORD = /[^\p{L}\p{N}]+/gu;

/** Plain, comparable form of a name: lower-case letters and digits separated by single spaces. */
export function normalizeName(name: string): string {
  return name
    .replace(/[İIı]/g, "i")
    .toLowerCase()
    .normalize("NFKD")
    .replace(MARKS, "")
    .replace(NOT_WORD, " ")
    .trim();
}

function bigrams(value: string): Map<string, number> {
  const compact = value.replace(/ /g, "");
  const counts = new Map<string, number>();
  for (let i = 0; i + 1 < compact.length; i++) {
    const gram = compact.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

function diceBigrams(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  let sizeA = 0;
  let sizeB = 0;
  let common = 0;
  for (const n of ga.values()) sizeA += n;
  for (const n of gb.values()) sizeB += n;
  for (const [gram, n] of ga) common += Math.min(n, gb.get(gram) ?? 0);
  if (sizeA + sizeB === 0) return a === b ? 1 : 0;
  return (2 * common) / (sizeA + sizeB);
}

/**
 * Share of the shorter name's words found in the longer one, eased down a little for
 * every extra word the longer one carries, so "Bravo" prefers the listing "Bravo" over
 * "Bravo Pizza Express" while still accepting "Bravo Coffee Roastery".
 */
function tokenContainment(a: string, b: string): number {
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return 0;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const pool = new Set(longer);
  const found = shorter.filter((token) => pool.has(token)).length;
  const extraWords = longer.length - shorter.length;
  return (found / shorter.length) * (1 - 0.02 * extraWords);
}

/** 0 when the names share nothing, 1 when one is the other; just under 1 when one sits whole inside the other. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(tokenContainment(na, nb), diceBigrams(na, nb));
}
