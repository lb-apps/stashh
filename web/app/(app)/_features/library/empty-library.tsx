"use client";

import * as React from "react";
import { ButtonLink } from "@/lib/discovery/components/Button";
import { EmptyState } from "@/lib/discovery/components/EmptyState";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { useCopy } from "@/lib/i18n/provider";
import { libraryCopy } from "./copy";

/** Glossy object size in px at the empty state. */
const OBJECT = 140;
/** Places arrive through the Instagram DM: the button opens that conversation. */
const INSTAGRAM_DM = "https://ig.me/m/stashh.me";

/** Nothing saved yet: the glossy object, one line on how places get here, and the way to the DM. Home and library share it. */
export function EmptyLibrary() {
  const copy = useCopy(libraryCopy);
  return (
    <EmptyState
      object={<GlossyObject tint="acid" size={OBJECT} alt="" />}
      headline={copy.emptyHeadline}
      sub={copy.emptySub}
      action={
        <ButtonLink href={INSTAGRAM_DM} variant="primary" size="lg" shape="pill">
          {copy.messageUs}
        </ButtonLink>
      }
    />
  );
}
