"use client";

import * as React from "react";
import { Button } from "@/lib/discovery/components/Button";
import { EmptyState } from "@/lib/discovery/components/EmptyState";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { useCopy } from "@/lib/i18n/provider";
import { useSheetNav } from "../shell/sheet-state";
import { libraryCopy } from "./copy";

/** Glossy object size in px at the empty state. */
const OBJECT = 140;

/** Nothing saved yet: the glossy object, one line on what to do, and the paste action. Home and library share it. */
export function EmptyLibrary() {
  const copy = useCopy(libraryCopy);
  const { open } = useSheetNav();
  return (
    <EmptyState
      object={<GlossyObject tint="acid" size={OBJECT} alt="" />}
      headline={copy.emptyHeadline}
      sub={copy.emptySub}
      action={
        <Button variant="primary" size="lg" shape="pill" onClick={() => open({ name: "paste" })}>
          {copy.pasteReel}
        </Button>
      }
    />
  );
}
