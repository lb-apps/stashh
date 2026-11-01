import { isRecord, senderKey, str, type HookSlice, type HookSource } from "./types.ts";

/**
 * Instagram API with Instagram Login deliveries: `{ object: "instagram", entry: [{ id, time,
 * messaging: [...], changes?: [...] }] }`, where `entry.id` is the connected account. A messaging
 * item's sender is the side that is not the account: the sender of a DM, a tap or a read, the
 * recipient of an echo. `changes` (comments, the dashboard's Test tool) and items naming only the
 * account belong to no one.
 *
 * https://developers.facebook.com/docs/instagram-platform/webhooks/examples
 */

function partyOf(item: Record<string, unknown>, accountId: string): string {
  const message = isRecord(item["message"]) ? item["message"] : null;
  const party = message?.["is_echo"] ? item["recipient"] : item["sender"];
  const id = isRecord(party) ? str(party["id"]) : "";
  return id && id !== accountId ? id : "";
}

function messagingOf(entry: unknown): Array<Record<string, unknown>> {
  return isRecord(entry) && Array.isArray(entry["messaging"]) ? entry["messaging"].filter(isRecord) : [];
}

export const instagramSource: HookSource = {
  id: "instagram",

  split(payload) {
    if (!isRecord(payload) || payload["object"] !== "instagram" || !Array.isArray(payload["entry"])) return null;
    const slices: HookSlice[] = [];
    for (const entry of payload["entry"]) {
      if (!isRecord(entry)) continue;
      const base: Record<string, unknown> = { ...entry };
      delete base["messaging"];
      delete base["changes"];
      const changes = entry["changes"];
      const accountId = str(entry["id"]);

      const bySender = new Map<string, Array<Record<string, unknown>>>();
      const unowned: Array<Record<string, unknown>> = [];
      for (const item of messagingOf(entry)) {
        const sender = partyOf(item, accountId);
        if (!sender) {
          unowned.push(item);
          continue;
        }
        const items = bySender.get(sender) ?? [];
        items.push(item);
        bySender.set(sender, items);
      }

      for (const [sender, items] of bySender) slices.push({ key: senderKey("instagram", sender), entry: { ...base, messaging: items } });
      if (unowned.length > 0 || changes !== undefined) {
        slices.push({
          key: null,
          entry: { ...base, ...(unowned.length > 0 ? { messaging: unowned } : {}), ...(changes !== undefined ? { changes } : {}) },
        });
      }
    }
    return slices;
  },

  assemble(payload, entries) {
    return { ...(isRecord(payload) ? payload : {}), entry: entries };
  },

  typedTexts(entry) {
    const texts: Array<{ index: number; text: string }> = [];
    messagingOf(entry).forEach((item, index) => {
      const message = isRecord(item["message"]) ? item["message"] : null;
      if (!message || message["is_echo"] || message["is_deleted"]) return;
      if (Array.isArray(message["attachments"]) && message["attachments"].length > 0) return;
      const text = str(message["text"]);
      if (text) texts.push({ index, text });
    });
    return texts;
  },
};
