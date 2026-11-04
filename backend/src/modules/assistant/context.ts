import type { ListSummaryDto } from "../lists/service.js";

/**
 * The per-turn account block: what the model knows about this person without a tool call.
 * Sent as its own system message after the cached prompt, so it can change every turn.
 */

export interface AccountContext {
  profile: { username: string | null; displayName: string | null } | null;
  savedCount: number;
  lists: ListSummaryDto[];
  recentRecognitions: Array<{
    recognition_id: string;
    at: string;
    source_type: string | null;
    author_username: string | null;
    places: Array<{ place_id: string | null; name: string }>;
  }>;
  now: Date;
}

const SOURCE_NOUN: Record<string, string> = { reel: "Reel", post: "post", story: "story", tiktok: "TikTok video" };

function relativeTime(at: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(at).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function buildContextBlock(context: AccountContext): string {
  const lines: string[] = ["## This person's account (live, this turn)"];
  const who = [context.profile?.displayName, context.profile?.username ? `@${context.profile.username}` : null].filter(Boolean).join(" ");
  lines.push(`- Instagram: ${who || "profile not read yet"}`);
  lines.push(`- Saved places: ${context.savedCount}`);

  if (context.lists.length === 0) {
    lines.push("- Lists: none yet");
  } else {
    lines.push(`- Lists (${context.lists.length}):`);
    for (const list of context.lists) {
      const emoji = list.emoji ? `${list.emoji} ` : "";
      lines.push(`  - ${emoji}${list.title} · ${list.place_count} place${list.place_count === 1 ? "" : "s"} · list_id ${list.id}`);
    }
  }

  if (context.recentRecognitions.length === 0) {
    lines.push("- Recent shares: none yet");
  } else {
    lines.push("- Recent shares (newest first; places already saved):");
    for (const recognition of context.recentRecognitions) {
      const noun = SOURCE_NOUN[recognition.source_type ?? ""] ?? "share";
      const by = recognition.author_username ? ` by @${recognition.author_username}` : "";
      const places =
        recognition.places.length === 0
          ? "no places found"
          : recognition.places.map((place) => (place.place_id ? `${place.name} (place_id ${place.place_id})` : place.name)).join(", ");
      lines.push(`  - ${relativeTime(recognition.at, context.now)}: ${noun}${by} → ${places} · recognition_id ${recognition.recognition_id}`);
    }
  }

  lines.push(`- Now: ${context.now.toISOString()}`);
  return lines.join("\n");
}
