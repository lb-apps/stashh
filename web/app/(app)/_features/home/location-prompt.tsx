"use client";

import * as React from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@/lib/discovery/components/Button";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { useCopy } from "@/lib/i18n/provider";
import { useLocation } from "@/lib/platform/location";
import { QuietNote } from "../shell/sheet-parts";
import { homeCopy } from "./copy";

/**
 * "Near you" without a position: one button that asks for it. The browser's
 * own prompt follows the tap, so there is no priming dialog in front of it.
 * Denied (or timed out in an in-app browser): one line on how to turn it on.
 */
export function LocationPrompt() {
  const copy = useCopy(homeCopy);
  const { state, locate } = useLocation();

  if (state.status === "granted") return null;
  if (state.status === "denied") return <QuietNote>{copy.locationOff}</QuietNote>;

  const locating = state.status === "locating";
  return (
    <div>
      <Button variant="secondary" shape="pill" disabled={locating} onClick={() => void locate()} leadingIcon={<Glyph icon={LocateFixed} />}>
        {locating ? copy.locating : copy.useLocation}
      </Button>
    </div>
  );
}
