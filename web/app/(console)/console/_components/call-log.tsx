"use client";

import { useState } from "react";
import { Icon } from "@/lib/discovery";
import type { BackendCall } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { SectionTitle } from "./section-title";

export function CallLog({ calls }: { calls: BackendCall[] }) {
  const totalMs = calls.reduce((sum, call) => sum + call.durationMs, 0);
  const slowest = calls.reduce((max, call) => Math.max(max, call.durationMs), 0);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle trailing={`${calls.length} · ${formatDuration(totalMs)}`}>
        Requests
      </SectionTitle>

      <ol className="surface-panel overflow-hidden">
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
    <li className="animate-enter-rise border-b border-grey-200 last:border-b-0">
      <button
        aria-expanded={isExpanded}
        className="group flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-grey-100 focus-visible:bg-grey-100"
        onClick={() => setIsExpanded((value) => !value)}
        type="button"
      >
        <span
          className={`w-11 shrink-0 font-mono text-nano font-bold tracking-wide ${
            call.method === "POST" ? "text-cobalt-500" : "text-grey-800"
          }`}
        >
          {call.method}
        </span>

        <span className="min-w-0 flex-1 truncate font-mono text-micro">{shortPath}</span>

        {/* Duration bar sits behind the number so scanning for the outlier is
            a glance, not arithmetic. */}
        <span className="hidden h-1 w-24 shrink-0 overflow-hidden rounded-full bg-grey-200 sm:block">
          <span
            className={`block h-full rounded-full ${
              call.ok ? "bg-cobalt-500/60" : "bg-red-500"
            }`}
            style={{ width: `${widthPct}%` }}
          />
        </span>

        <span
          className={`w-9 shrink-0 text-right font-mono text-nano tabular-nums ${
            call.ok ? "text-grey-800" : "font-bold text-ink-primary"
          }`}
        >
          {call.status || "ERR"}
        </span>
        <span className="w-14 shrink-0 text-right font-mono text-micro tabular-nums">
          {formatDuration(call.durationMs)}
        </span>

        <Icon
          className={`shrink-0 text-grey-800 transition-transform duration-200 ease-out ${
            isExpanded ? "rotate-90" : ""
          }`}
          name="chevron-right"
          size={14}
        />
      </button>

      {isExpanded ? (
        <div className="animate-enter-rise px-4 pb-4">
          {call.error ? (
            <p className="mb-2 rounded-xs bg-red-500/10 px-3 py-2 text-micro text-ink-primary">
              {call.error}
            </p>
          ) : null}
          <pre className="max-h-80 overflow-auto rounded-sm bg-grey-100 p-3 font-mono text-nano leading-relaxed text-grey-800">
            {JSON.stringify(call.raw, null, 2)}
          </pre>
        </div>
      ) : null}
    </li>
  );
}
