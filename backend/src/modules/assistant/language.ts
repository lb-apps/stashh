/**
 * A rough read of the language a message is written in, for the two languages this channel sees
 * most. It only adds a hint next to the newest message ("written in English"), so the model
 * follows the latest message rather than the language of a long history; when nothing matches,
 * no hint is given and the prompt's own rule decides.
 */

const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const TURKISH_WORDS = new Set([
  "ve", "bir", "bu", "şu", "ne", "mi", "mı", "mu", "mü", "nasıl", "naber", "var", "yok", "bana", "ben", "sen", "için", "ile", "ama", "evet",
  "hayır", "merhaba", "selam", "liste", "listem", "listelerim", "mekan", "mekân", "harita", "haritam", "göster", "ekle", "sil", "neler", "nerede",
  "nerde", "hangi", "son", "yeni", "kaydet", "kaydettim", "lütfen", "tamam", "olsun", "istiyorum", "çok", "daha", "de", "da", "ya",
]);
const ENGLISH_WORDS = new Set([
  "the", "what", "is", "are", "my", "me", "i", "you", "a", "an", "to", "of", "in", "on", "and", "or", "show", "send", "list", "lists", "places",
  "place", "map", "where", "how", "can", "do", "did", "save", "saved", "add", "delete", "remove", "new", "last", "please", "thanks", "hello", "hi",
  "hey", "yes", "no", "this", "that", "it", "should", "which", "open", "create", "make", "put", "from", "with", "for",
]);

export type LanguageHint = "Turkish" | "English";

export function detectLanguage(text: string): LanguageHint | null {
  if (TURKISH_LETTERS.test(text)) return "Turkish";
  const words = text.toLowerCase().match(/[a-zçğıöşü']+/g) ?? [];
  if (words.length === 0) return null;
  const turkish = words.filter((w) => TURKISH_WORDS.has(w)).length;
  const english = words.filter((w) => ENGLISH_WORDS.has(w)).length;
  if (english === 0 && turkish === 0) return null;
  if (english > turkish) return "English";
  if (turkish > english) return "Turkish";
  return null;
}

/** The line under the newest message, when its language could be read. */
export function languageHintLine(text: string): string | null {
  const language = detectLanguage(text);
  return language ? `(written in ${language}: reply, quick replies and button titles in ${language})` : null;
}
