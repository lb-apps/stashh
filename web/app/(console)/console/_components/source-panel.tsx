"use client";

import { useState } from "react";
import { Badge, Icon } from "@/lib/discovery";
import type { RecognitionResult } from "@/lib/types";
import { SectionTitle } from "./section-title";

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

      <div className="surface-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4">
          <Badge tone="grey">{result.source_type}</Badge>
          <Badge tone={result.video_url ? "cobaltSoft" : "amberSoft"}>
            {result.video_url ? "video resolved" : "no video"}
          </Badge>
          <Badge tone={caption ? "cobaltSoft" : "amberSoft"}>
            {caption ? "caption found" : "no caption"}
          </Badge>
        </div>

        {caption ? (
          <div className="px-4 pb-4">
            <p className="whitespace-pre-wrap text-caption leading-relaxed">
              {visible}
            </p>
            {isLong ? (
              <button
                className="mt-1 min-h-11 cursor-pointer text-micro font-semibold text-cobalt-500 transition-opacity duration-150 hover:opacity-70"
                onClick={() => setShowFullCaption((value) => !value)}
                type="button"
              >
                {showFullCaption ? "Show less" : "Show full caption"}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="px-4 pb-4 text-caption text-grey-800">
            No caption was extracted from this post.
          </p>
        )}

        {result.video_url ? (
          <>
            <button
              aria-expanded={showVideoUrl}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-t border-grey-200 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-grey-100"
              onClick={() => setShowVideoUrl((value) => !value)}
              type="button"
            >
              <span className="flex-1 text-micro text-grey-800">Resolved video URL</span>
              <Icon
                className={`text-grey-800 transition-transform duration-200 ease-out ${
                  showVideoUrl ? "rotate-90" : ""
                }`}
                name="chevron-right"
                size={14}
              />
            </button>
            {showVideoUrl ? (
              <div className="animate-enter-rise px-4 pb-4">
                <p className="break-all rounded-sm bg-grey-100 p-3 font-mono text-nano leading-relaxed text-grey-800">
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
