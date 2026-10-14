"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OPS_RANGES, RANGE_LABELS, RANGE_SHORT_LABELS, type OpsRange } from "@/lib/ops-types";
import { useOpsControls } from "./ops-provider";
import { StatusDot } from "./status-dot";

/**
 * The console kit's page head: a heavy display title, one helper sentence, and the
 * controls that apply to the whole page (time range, live refresh) on the right.
 */
export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <SidebarTrigger className="-ml-2 basis-full justify-start md:hidden" />
      <div className="min-w-60 flex-1">
        <h1 className="font-heading text-display">{title}</h1>
        <p className="mt-1.5 text-body text-muted-foreground">{description}</p>
      </div>
      <PageControls />
    </header>
  );
}

/**
 * Whether any ops query is in flight. Unlike useIsFetching it reports false while
 * hydrating — the server never fetches — so the live dot cannot mismatch the HTML.
 */
function useOpsFetching(): boolean {
  const client = useQueryClient();
  return useSyncExternalStore(
    (onChange) => client.getQueryCache().subscribe(onChange),
    () => client.isFetching({ queryKey: ["ops"] }) > 0,
    () => false,
  );
}

function PageControls() {
  const { range, setRange, live, setLive } = useOpsControls();
  const fetching = useOpsFetching();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ToggleGroup
        type="single"
        variant="segmented"
        value={range}
        onValueChange={(value) => value && setRange(value as OpsRange)}
        aria-label="Time range"
      >
        {OPS_RANGES.map((option) => (
          <ToggleGroupItem key={option} value={option} aria-label={RANGE_LABELS[option]}>
            <span className="sm:hidden">{RANGE_SHORT_LABELS[option]}</span>
            <span className="hidden sm:inline">{RANGE_LABELS[option]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-center gap-2.5">
        <Switch id="live-refresh" checked={live} onCheckedChange={setLive} aria-label="Live refresh" />
        <Label htmlFor="live-refresh" className="gap-1.5 font-heading text-caption font-semibold">
          <StatusDot state={live ? "live" : "unknown"} pulse={live && fetching} />
          {live ? "Live" : "Paused"}
        </Label>
      </div>
    </div>
  );
}
