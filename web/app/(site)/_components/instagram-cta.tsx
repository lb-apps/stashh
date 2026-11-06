"use client";

import * as React from "react";
import { startAnalytics, track } from "@/lib/analytics/analytics";

const INSTAGRAM_DM = "https://ig.me/m/stashh.me";

/**
 * The landing page's one action. A client island so the page itself stays a
 * server component: it starts analytics (the page view) and reports the tap.
 * Discovery's Button is a <button>; this navigates, so it is an <a> drawn to
 * the same spec as Button `variant="onBrand" size="lg"`.
 */
export function InstagramCta({ children }: { children: React.ReactNode }) {
  React.useEffect(() => startAnalytics(), []);

  return (
    <a
      className="press inline-flex h-14.5 items-center justify-center rounded-cta bg-surface-card px-6.5 font-ui text-body-lg font-semibold tracking-(--tr-tight) text-cobalt-500 shadow-float hover:opacity-100"
      href={INSTAGRAM_DM}
      onClick={() => track("instagram_cta_clicked", { surface: "landing" }, { leavesPage: true })}
    >
      {children}
    </a>
  );
}
