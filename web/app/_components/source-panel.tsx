"use client";

import { useState } from "react";
import type { RecognitionResult } from "@/lib/types";
import { SectionTitle } from "./section-title";
import { ChevronIcon } from "./icons";

const CLAMP_LENGTH = 260;

/** What the scraper actually pulled off the post — the input Gemini reasoned over. */
export function SourcePanel({ result }: { result: RecognitionResult }) {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [showVideoUrl, setShowVideoUrl] = useState(false);

  const caption = result.caption?.trim() ?? "";
  const isLong = caption.length > CLAMP_LENGTH;
  const visible =
    isLong && !showFullCaption ? `${caption.slice(0, CLAMP_LENGTH).trimEnd()}…` : caption;

  return (
    <section className="animate-enter-rise flex flex-col gap-3">
      <SectionTitle trailing={`${caption.length} chars`}>Scraped source</SectionTitle>

      <div className="surface-panel overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4">
          <Pill tone="neutral">{result.source_type}</Pill>
          <Pill tone={result.video_url ? "success" : "danger"}>
            {result.video_url ? "video resolved" : "no video"}
          </Pill>
          <Pill tone={caption ? "success" : "warning"}>
            {caption ? "caption found" : "no caption"}
          </Pill>
        </div>

        {caption ? (
          <div className="px-4 pb-4">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
              {visible}
            </p>
            {isLong ? (
              <button
                className="mt-2 cursor-pointer text-xs font-medium text-accent-strong transition-opacity duration-150 hover:opacity-80"
                onClick={() => setShowFullCaption((value) => !value)}
                type="button"
              >
                {showFullCaption ? "Show less" : "Show full caption"}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="px-4 pb-4 text-[13px] text-muted">
            No caption was extracted from this post.
          </p>
        )}

        {result.video_url ? (
          <>
            <button
              aria-expanded={showVideoUrl}
              className="flex w-full cursor-pointer items-center gap-2 border-t border-[var(--console-hairline)] px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/4"
              onClick={() => setShowVideoUrl((value) => !value)}
              type="button"
            >
              <span className="flex-1 text-xs text-muted">Resolved video URL</span>
              <ChevronIcon
                className={`size-3.5 text-muted transition-transform duration-200 ease-out ${
                  showVideoUrl ? "rotate-90" : ""
                }`}
              />
            </button>
            {showVideoUrl ? (
              <div className="animate-enter-rise px-4 pb-4">
                <p className="break-all rounded-xl bg-black/25 p-3 font-mono text-[11px] leading-relaxed text-foreground/70">
                  {result.video_url}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-white/6 text-muted",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger/12 text-danger",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
