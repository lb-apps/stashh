import { randomBytes } from "node:crypto";

/**
 * Text a stranger wrote, made safe to put in front of a model or on a screen.
 *
 * The characters removed carry nothing a reader sees but can carry a whole instruction:
 * - Unicode tag characters (U+E0000–E007F), "ASCII smuggling": every ASCII letter has an
 *   invisible twin there. The one legitimate use, subdivision flags (🏴 + tags + cancel tag,
 *   as in the flag of Scotland), is kept.
 * - Runs of variation selectors, "emoji smuggling": one selector after a character is
 *   legitimate (an emoji's presentation, a CJK ideographic variant), a run of them encodes bytes.
 *   The first of a run is kept.
 * - Bidi embeddings, overrides and isolates (U+202A–202E, U+2066–2069), which reorder what a
 *   reader sees ("Trojan Source"). The plain direction marks U+200E/U+200F stay: Arabic and
 *   Hebrew text uses them.
 * - Zero-width and invisible fillers (U+200B, U+2060–2064, U+FEFF, U+180E, U+00AD, U+3164,
 *   U+FFA0). ZWJ (U+200D) and ZWNJ (U+200C) stay: emoji sequences and Persian, Arabic and Indic
 *   spelling need them.
 * - C0/C1 control characters other than tab and newline.
 *
 * Nothing is done per language or per script: the text keeps its own spelling (NFC only).
 */

const TAG_OR_FLAG = /(\u{1F3F4}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{2,7}\u{E007F})|[\u{E0000}-\u{E007F}]/gu;
const SELECTOR_RUN = /([︀-️\u{E0100}-\u{E01EF}])[︀-️\u{E0100}-\u{E01EF}]+/gu;
const INVISIBLE = /[‪-‮⁦-⁩​⁠-⁤﻿᠎­ㅤﾠ\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu;

export interface SanitizedText {
  text: string;
  /** Hidden characters removed; anything above zero on a post is worth a log line. */
  hidden: number;
  truncated: boolean;
}

export function sanitizeUntrustedText(input: string, maxChars: number): SanitizedText {
  const nfc = input.normalize("NFC").replace(/\r\n?/g, "\n");
  let hidden = 0;
  const visible = nfc
    .replace(TAG_OR_FLAG, (_match, flag: string | undefined) => {
      if (flag) return flag;
      hidden += 1;
      return "";
    })
    .replace(SELECTOR_RUN, (match, first: string) => {
      hidden += [...match].length - 1;
      return first;
    })
    .replace(INVISIBLE, () => {
      hidden += 1;
      return "";
    })
    // A wall of blank lines pushes an instruction out of a reviewer's sight; three is plenty.
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  const codePoints = [...visible];
  if (codePoints.length <= maxChars) return { text: visible, hidden, truncated: false };
  return { text: `${codePoints.slice(0, maxChars).join("").trimEnd()}…`, hidden, truncated: true };
}

/** `sanitizeUntrustedText(...).text`, for callers that only want the clean string. */
export function cleanUntrustedText(input: string, maxChars: number): string {
  return sanitizeUntrustedText(input, maxChars).text;
}

/**
 * Untrusted text between two markers that carry a random id ("spotlighting"). The id is new on
 * every call, so text inside cannot close the block early: it would have to guess the id.
 */
export function fenceUntrusted(label: string, text: string): string {
  const id = randomBytes(6).toString("hex");
  return `<<<${label} ${id}>>>\n${text}\n<<<END ${label} ${id}>>>`;
}

// ── Contact details and links in generated text ───────────────────────────────────────────────

const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}][\p{L}\p{N}-]*(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,24}\b(?:\/\S*)?/giu;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
/** A leading "+" and six or more digits, or nine or more digits however they are grouped. */
const PHONE = /\+\d[\d\s().-]{5,}\d|\b\d(?:[\s().-]?\d){8,}\b/g;
const HANDLE = /(?:^|[^\p{L}\p{N}_@])@[\p{L}\p{N}._]{2,}/gu;
const WALLET = /\b(?:bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,59}\b|\b0x[a-fA-F0-9]{40}\b/g;

export interface ContactToken {
  kind: "url" | "email" | "phone" | "handle" | "wallet";
  value: string;
}

/** Links, e-mail addresses, phone numbers, @handles and crypto wallets in a piece of text. */
export function findContactTokens(text: string): ContactToken[] {
  const tokens: ContactToken[] = [];
  const emails = new Set<string>();
  for (const match of text.matchAll(EMAIL)) {
    emails.add(match[0]);
    tokens.push({ kind: "email", value: match[0] });
  }
  // An e-mail's domain is not a second finding.
  const withoutEmails = [...emails].reduce((acc, email) => acc.split(email).join(" "), text);
  for (const match of withoutEmails.matchAll(URL_LIKE)) tokens.push({ kind: "url", value: match[0] });
  for (const match of text.matchAll(PHONE)) tokens.push({ kind: "phone", value: match[0] });
  for (const match of withoutEmails.matchAll(HANDLE)) tokens.push({ kind: "handle", value: match[0].replace(/^[^@]*/, "") });
  for (const match of text.matchAll(WALLET)) tokens.push({ kind: "wallet", value: match[0] });
  return tokens;
}

/** The comparable form of a token: a URL's host, a phone's digits, an address lower-cased. */
export function contactKey(token: ContactToken): string {
  switch (token.kind) {
    case "url": {
      const bare = token.value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
      return `url:${bare.split(/[/?#]/)[0]!.replace(/[.,;:!?)]+$/, "").toLowerCase()}`;
    }
    case "phone":
      return `phone:${token.value.replace(/\D/g, "").slice(-10)}`;
    default:
      return `${token.kind}:${token.value.toLowerCase()}`;
  }
}
