"use client";

import * as React from "react";
import { SectionHeader } from "@/lib/discovery/components/SectionHeader";

/** A home section: the heavy title (a button with a chevron when `onMore` is set), its count, then the content. */
export function HomeSection({ title, meta, onMore, children }: { title: string; meta?: string; onMore?: () => void; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <SectionHeader title={title} meta={meta} onClick={onMore} />
      {children}
    </section>
  );
}
