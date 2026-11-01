"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/lib/discovery/components/Button";
import { SheetHeader } from "@/lib/discovery/components/DetentSheet";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy } from "@/lib/i18n/provider";
import { useStartRecognition } from "@/lib/stashh/mutations";
import { keys, useRecognition } from "@/lib/stashh/queries";
import { useSheetNav } from "../shell/sheet-state";
import { recognizeCopy } from "./copy";
import { recognitionOutcome, STAGE_ORDER, type FailureKind, type Outcome } from "./recognition-view";
import { parseSourceLink } from "./source-link";

/** Glossy object sizes: the working orb at peek, the empty-handed one at full height. */
const WORKING_OBJECT = 96;
const FAILED_OBJECT = 120;
/** Stage dot diameter, its check, and the spinner ring width. */
const DOT = 34;
const DOT_CHECK = 18;
const RING = 3;

const STILL_WORKING: Outcome = { kind: "working", step: -1 };

/**
 * A recognition in progress, peeking over the map: the four stages follow the
 * worker's real `stage`. When it settles, places go to the results sheet; a
 * failure (or a read with nothing to save) stays here, pulled up to full height.
 */
export function RecognizingSheet({ recognitionId }: { recognitionId: string }) {
  const nav = useSheetNav();
  const client = useQueryClient();
  const recognition = useRecognition(recognitionId);
  const data = recognition.data;
  const outcome: Outcome = recognition.isError ? { kind: "failed", reason: "unreadable" } : data ? recognitionOutcome(data) : STILL_WORKING;

  // The poll settling is the external event: move on once, when it does.
  const settle = React.useEffectEvent((kind: "found" | "failed") => {
    if (kind === "found") {
      // "Last pulled in" and the results header want this post's author.
      void client.invalidateQueries({ queryKey: keys.recents });
      nav.open({ name: "results", recognitionId });
    } else {
      nav.open({ name: "recognizing", recognitionId }, "full");
    }
  });
  React.useEffect(() => {
    if (outcome.kind !== "working") settle(outcome.kind);
  }, [outcome.kind]);

  if (outcome.kind === "failed") return <RecognitionFailed reason={outcome.reason} sourceUrl={data?.source_url ?? null} />;

  return <RecognitionProgress step={outcome.kind === "working" ? outcome.step : STAGE_ORDER.length} sourceUrl={data?.source_url ?? null} />;
}

function RecognitionProgress({ step, sourceUrl }: { step: number; sourceUrl: string | null }) {
  const c = useCopy(recognizeCopy);
  const link = sourceUrl ? parseSourceLink(sourceUrl) : null;
  const foot = step < 0 ? c.foot.queued : step < 2 ? c.foot.early : c.foot.late;

  return (
    <>
      <SheetHeader align="center" style={{ paddingBottom: "var(--sp-5)" }}>
        <MicroLabel as="h2" style={{ margin: 0, textAlign: "center" }}>
          {!link ? c.progress : link.platform === "tiktok" ? c.platform.tiktok : `${c.platform.instagram} · ${c.sourceType[link.kind === "post" ? "post" : "reel"]}`}
        </MicroLabel>
      </SheetHeader>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-9)", padding: "var(--sp-5) var(--gutter) var(--sp-9)" }}>
        <GlossyObject size={WORKING_OBJECT} tint="acid" aria-hidden="true" />
        <StageList step={step} />
        <p className="ds-caption" style={{ margin: 0, textAlign: "center", color: TEXT_SECONDARY_STRONG }}>
          {foot}
        </p>
      </div>
    </>
  );
}

/** The four stages: done ones ticked, the running one spinning, the rest waiting. Announced as they change. */
function StageList({ step }: { step: number }) {
  const c = useCopy(recognizeCopy);
  return (
    <ol aria-label={c.progress} aria-live="polite" style={{ listStyle: "none", margin: 0, padding: 0, width: "100%", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {c.stages.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} aria-current={active ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)", minHeight: "var(--hit-min)" }}>
            <span
              aria-hidden="true"
              className={active ? "animate-spin motion-reduce:animate-none" : undefined}
              style={{
                flex: "0 0 auto",
                width: DOT,
                height: DOT,
                boxSizing: "border-box",
                borderRadius: "var(--r-circle)",
                display: "grid",
                placeItems: "center",
                color: "var(--white)",
                ...(done
                  ? { background: "var(--fill-primary)", boxShadow: "var(--gloss-top)" }
                  : active
                    ? { border: `${RING}px solid var(--cobalt-100)`, borderTopColor: "var(--cobalt-500)" }
                    : { background: "var(--surface-sunken)" }),
              }}
            >
              {done ? <Glyph icon={Check} size={DOT_CHECK} /> : null}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-body-lg)",
                lineHeight: "var(--lh-label)",
                fontWeight: active ? "var(--fw-bold)" : "var(--fw-semibold)",
                letterSpacing: "var(--tr-tight)",
                color: active ? "var(--text-primary)" : TEXT_SECONDARY_STRONG,
              }}
            >
              {label}
            </span>
            {done ? (
              <span style={{ fontFamily: "var(--font-rounded)", fontSize: "var(--fs-micro)", fontWeight: "var(--fw-heavy)", color: TEXT_SECONDARY_STRONG }}>
                {c.stageDone}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Nothing to save, and why. "Try that link again" only where trying again can
 * help (the media was withheld, or we failed); a private account or a video
 * with no venue in it will read the same the second time.
 */
function RecognitionFailed({ reason, sourceUrl }: { reason: FailureKind; sourceUrl: string | null }) {
  const c = useCopy(recognizeCopy);
  const nav = useSheetNav();
  const start = useStartRecognition();
  const copy = c.fail.reasons[reason];
  const canRetry = sourceUrl != null && (reason === "unavailable" || reason === "unreadable");

  const retry = () => {
    if (!sourceUrl) return;
    start.mutate(sourceUrl, { onSuccess: ({ recognition_id }) => nav.open({ name: "recognizing", recognitionId: recognition_id }) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "var(--sp-6) var(--gutter) var(--sp-9)" }}>
        <GlossyObject size={FAILED_OBJECT} tint="chrome" aria-hidden="true" />
        <h2 className="ds-title-1" style={{ margin: "var(--sp-9) 0 0", fontWeight: "var(--fw-heavy)", whiteSpace: "pre-line" }}>
          {copy.title}
        </h2>
        <p className="ds-body-lg" style={{ margin: "var(--sp-5) 0 0", color: TEXT_SECONDARY_STRONG, textWrap: "pretty" }}>
          {copy.body}
        </p>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--sp-5)", marginTop: "var(--sp-9)" }}>
          {canRetry ? (
            <Button variant="primary" size="lg" shape="pill" fullWidth disabled={start.isPending} onClick={retry}>
              {c.fail.retry}
            </Button>
          ) : null}
          <Button variant={canRetry ? "secondary" : "primary"} size="lg" shape="pill" fullWidth onClick={() => nav.open({ name: "paste" })}>
            {c.fail.other}
          </Button>
        </div>
    </div>
  );
}
