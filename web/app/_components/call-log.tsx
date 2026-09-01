"use client";

import { useState } from "react";
import type { BackendCall } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { SectionTitle } from "./section-title";
import { ChevronIcon } from "./icons";

export function CallLog({ calls }: { calls: BackendCall[] }) {
  const totalMs = calls.reduce((sum, call) => sum + call.durationMs, 0);
  const slowest = calls.reduce((max, call) => Math.max(max, call.durationMs), 0);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle trailing={`${calls.length} · ${formatDuration(totalMs)}`}>
        Requests
      </SectionTitle>

      <ol className="surface-panel overflow-hidden rounded-2xl">
        {calls.map((call, index) => (
          <CallRow
            call={call}
            key={`${call.method}-${call.path}-${index}`}
            slowest={slowest}
          />
        ))}
      </ol>
    </section>
  );
}

function CallRow({ call, slowest }: { call: BackendCall; slowest: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const widthPct = slowest > 0 ? Math.max(3, (call.durationMs / slowest) * 100) : 0;
  const shortPath = call.path.replace(/^\/api\/v1/, "");

  return (
    <li className="animate-enter-rise border-b border-[var(--console-hairline)] last:border-b-0">
      <button
        aria-expanded={isExpanded}
        className="group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/4 focus-visible:bg-white/4 focus-visible:outline-none"
        onClick={() => setIsExpanded((value) => !value)}
        type="button"
      >
        <span
          className={`w-11 shrink-0 font-mono text-[10px] font-semibold tracking-wide ${
            call.method === "POST" ? "text-accent-strong" : "text-muted"
          }`}
        >
          {call.method}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono text-xs">{shortPath}</span>

        {/* Duration bar sits behind the number so scanning for the outlier is
            a glance, not arithmetic. */}
        <span className="hidden h-1 w-24 shrink-0 overflow-hidden rounded-full bg-white/6 sm:block">
          <span
            className={`block h-full rounded-full ${
              call.ok ? "bg-accent/60" : "bg-danger/70"
            }`}
            style={{ width: `${widthPct}%` }}
          />
        </span>

        <span
          className={`w-9 shrink-0 text-right font-mono text-[11px] tabular-nums ${
            call.ok ? "text-muted" : "text-danger"
          }`}
        >
          {call.status || "ERR"}
        </span>
        <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">
          {formatDuration(call.durationMs)}
        </span>

        <ChevronIcon
          className={`size-3.5 shrink-0 text-muted transition-transform duration-200 ease-out ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {isExpanded ? (
        <div className="animate-enter-rise px-4 pb-4">
          {call.error ? (
            <p className="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {call.error}
            </p>
          ) : null}
          <pre className="max-h-80 overflow-auto rounded-xl bg-black/25 p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
            {JSON.stringify(call.raw, null, 2)}
          </pre>
        </div>
      ) : null}
    </li>
  );
}
