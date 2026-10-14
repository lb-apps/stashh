"use client";

import { useEffect, useState } from "react";

interface Health {
  reachable: boolean;
  durationMs: number;
  target: string;
}

export function BackendHealth() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body: Health = await res.json();
        if (!cancelled) setHealth(body);
      } catch {
        if (!cancelled) setHealth({ reachable: false, durationMs: 0, target: "" });
      }
    };

    void probe();
    const id = window.setInterval(probe, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const reachable = health?.reachable ?? false;

  return (
    <span
      className="flex items-center gap-2 rounded-full bg-surface-card px-3 py-1.5 text-micro shadow-card"
      title={health?.target || "backend"}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full transition-colors duration-300 ${
          !health ? "bg-grey-500" : reachable ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span className={reachable ? "text-grey-800" : "font-semibold text-ink-primary"}>
        {!health ? "checking" : reachable ? "backend" : "unreachable"}
      </span>
      {health && reachable ? (
        <span className="font-mono tabular-nums text-grey-800">
          {health.durationMs}ms
        </span>
      ) : null}
    </span>
  );
}
