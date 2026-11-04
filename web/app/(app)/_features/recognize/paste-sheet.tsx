"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ClipboardPaste, Film, X } from "lucide-react";
import { Badge } from "@/lib/discovery/components/Badge";
import { Button } from "@/lib/discovery/components/Button";
import { EmptyState } from "@/lib/discovery/components/EmptyState";
import { GhostInput } from "@/lib/discovery/components/GhostInput";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { IconButton } from "@/lib/discovery/components/IconButton";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { TEXT_DANGER_STRONG, TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { useStartRecognition } from "@/lib/stashh/mutations";
import { keys, useRecentRecognitions } from "@/lib/stashh/queries";
import type { RecentRecognition } from "@/lib/stashh/types";
import { Section, SheetBody, SheetTitle } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { recognizeCopy } from "./copy";
import { FieldCard, TapRow } from "./parts";
import { parseSourceLink, type SourceLink } from "./source-link";
import { useWatchClipboard } from "./stored-flag";

/** How many recent posts "Last pulled in" lists. */
const RECENTS_SHOWN = 5;
/** Recent post thumbnail, and its stand-in glyph. */
const THUMB = 48;
const THUMB_GLYPH = 20;
/** Empty-state object size. */
const EMPTY_OBJECT = 96;

const noSubscribe = () => () => {};

/** The Clipboard API, where the browser has it (some in-app browsers don't). */
function useCanReadClipboard(): boolean {
  return React.useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.clipboard?.readText === "function",
    () => false,
  );
}

/**
 * Paste a Reel. The clipboard is never read on load — in-app browsers block
 * it and it reads as snooping. The field takes a native paste anywhere; with
 * "Watch my clipboard" on, a Paste button reads it on the tap itself and
 * offers the link it finds. Links are checked here before anything is sent.
 */
export function PasteSheet() {
  const c = useCopy(recognizeCopy);
  const t = useT();
  const nav = useSheetNav();
  const client = useQueryClient();
  const start = useStartRecognition();
  const [watchClipboard] = useWatchClipboard();
  const canRead = useCanReadClipboard();
  const fieldRef = React.useRef<HTMLInputElement>(null);

  const [text, setText] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [clipboardLink, setClipboardLink] = React.useState<SourceLink | null>(null);

  const typedLink = parseSourceLink(text);
  const showPasteButton = watchClipboard && canRead;

  const begin = (link: SourceLink) =>
    start.mutate(link.url, {
      onSuccess: ({ recognition_id }) => {
        void client.invalidateQueries({ queryKey: keys.recents });
        nav.open({ name: "recognizing", recognitionId: recognition_id });
      },
    });

  const readClipboard = async () => {
    let value = "";
    try {
      value = await navigator.clipboard.readText();
    } catch {
      // Refused or unsupported: say nothing, the field is right there.
    }
    const link = parseSourceLink(value);
    if (link) {
      setClipboardLink(link);
    } else if (value.trim()) {
      // Something else is on the clipboard: put it in the field so the reader sees why it won't do.
      setText(value);
      setTouched(true);
    } else {
      fieldRef.current?.focus();
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (typedLink) begin(typedLink);
    else setTouched(true);
  };

  return (
    <>
      <SheetTitle title={c.paste.title} sub={c.paste.sub} />
      <SheetBody>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
          {clipboardLink ? (
            <ClipboardCard link={clipboardLink} busy={start.isPending} onFind={() => begin(clipboardLink)} onDismiss={() => setClipboardLink(null)} />
          ) : showPasteButton ? (
            <Button variant="secondary" size="lg" shape="pill" fullWidth leadingIcon={<Glyph icon={ClipboardPaste} />} onClick={readClipboard}>
              {c.paste.fromClipboard}
            </Button>
          ) : null}

          <form onSubmit={submit}>
            <FieldCard label={showPasteButton || clipboardLink ? c.paste.orPasteYourself : c.paste.pasteLink}>
              <GhostInput
                ref={fieldRef}
                size="md"
                align="left"
                inputMode="url"
                enterKeyHint="go"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={text}
                placeholder={c.paste.placeholder}
                onChange={(event) => setText(event.target.value)}
                onPaste={() => setTouched(true)}
                onBlur={() => setTouched(true)}
              />
            </FieldCard>
            <p aria-live="polite" className="ds-caption" style={{ margin: 0, color: TEXT_DANGER_STRONG }}>
              {start.isError ? (
                <span style={{ display: "block", marginTop: "var(--sp-5)" }}>{t.errors.generic}</span>
              ) : touched && text.trim() && !typedLink ? (
                <span style={{ display: "block", marginTop: "var(--sp-5)" }}>{c.paste.notALink}</span>
              ) : null}
            </p>
            {typedLink ? (
              <Button type="submit" variant="primary" size="lg" shape="pill" fullWidth disabled={start.isPending} style={{ marginTop: "var(--sp-7)" }}>
                {c.paste.find}
              </Button>
            ) : null}
          </form>
        </div>

        <RecentPosts />
      </SheetBody>
    </>
  );
}

/** The link the Paste button found, offered with its one action. */
function ClipboardCard({ link, busy, onFind, onDismiss }: { link: SourceLink; busy: boolean; onFind: () => void; onDismiss: () => void }) {
  const c = useCopy(recognizeCopy);
  return (
    <section aria-label={c.paste.onClipboard} style={{ padding: "var(--sp-8)", borderRadius: "var(--r-card-lg)", background: "var(--cobalt-50)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
        <Badge tone="cobalt">{c.platform[link.platform]}</Badge>
        <MicroLabel as="span">
          {c.paste.onClipboard}
        </MicroLabel>
      </div>
      <p
        className="ds-headline"
        style={{ margin: "var(--sp-3) 0 0", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {link.url.replace(/^https?:\/\/(www\.)?/i, "")}
      </p>
      <div style={{ display: "flex", gap: "var(--sp-5)", marginTop: "var(--sp-7)" }}>
        <Button variant="primary" size="lg" shape="pill" disabled={busy} onClick={onFind} style={{ flex: 1 }}>
          {c.paste.find}
        </Button>
        <IconButton variant="ghost" size="xl" label={c.paste.dismissLink} onClick={onDismiss} style={{ color: TEXT_SECONDARY_STRONG }}>
          <Glyph icon={X} />
        </IconButton>
      </div>
    </section>
  );
}

/** "Last pulled in": recent posts still being read or with places to save. */
function RecentPosts() {
  const c = useCopy(recognizeCopy);
  const nav = useSheetNav();
  const recents = useRecentRecognitions();
  const locale = useIntlLocale();
  const [now] = React.useState(() => Date.now());

  if (!recents.data) return null;
  const shown = recents.data.filter(isWorthShowing).slice(0, RECENTS_SHOWN);

  if (!shown.length) {
    return (
      <EmptyState
        object={<GlossyObject size={EMPTY_OBJECT} tint="cobalt" aria-hidden="true" />}
        headline={c.paste.nothingYet}
        sub={c.paste.nothingYetSub}
        style={{ paddingInline: 0 }}
      />
    );
  }

  return (
    <Section label={c.paste.lastPulledIn}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)" }}>
        {shown.map((r) => {
          const ready = r.status === "completed" || r.status === "committed";
          const kind = r.source_type ? c.sourceType[r.source_type] : null;
          return (
            <TapRow
              key={r.recognition_id}
              size="md"
              leading={
                <PlacePhoto
                  src={r.source_thumbnail_url}
                  category="default"
                  glyph={Film}
                  glyphSize={THUMB_GLYPH}
                  width={THUMB}
                  height={THUMB}
                  radius="var(--r-field)"
                  raised
                />
              }
              title={ready ? c.recent.found(r.place_count, r.author_username) : c.recent.reading}
              meta={[kind, timeAgo(r.created_at, now, locale)].filter(Boolean).join(" · ")}
              trailing={<Glyph icon={ChevronRight} style={{ color: TEXT_SECONDARY_STRONG }} />}
              onClick={() =>
                nav.open(ready ? { name: "results", recognitionId: r.recognition_id } : { name: "recognizing", recognitionId: r.recognition_id })
              }
            />
          );
        })}
      </div>
    </Section>
  );
}

/** Still being read, or finished with something to save. Failures and empty reads are not worth a row. */
function isWorthShowing(r: RecentRecognition): boolean {
  if (r.status === "queued" || r.status === "processing") return true;
  return (r.status === "completed" || r.status === "committed") && r.place_count > 0;
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "2 days ago", "yesterday", "just now"-style, in the reader's locale. */
function timeAgo(iso: string, now: number, locale: string): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const unit = UNITS.find(([, size]) => Math.abs(seconds) >= size);
  return unit ? format.format(Math.round(seconds / unit[1]), unit[0]) : format.format(0, "minute");
}
