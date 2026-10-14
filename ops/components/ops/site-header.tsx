"use client";

import { usePathname } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OPS_RANGES, RANGE_LABELS, RANGE_SHORT_LABELS, type OpsRange } from "@/lib/ops-types";
import { titleFor } from "./nav";
import { useOpsControls } from "./ops-provider";
import { StatusDot } from "./status-dot";

export function SiteHeader() {
  const pathname = usePathname();
  const { range, setRange, live, setLive } = useOpsControls();
  const fetching = useIsFetching({ queryKey: ["ops"] }) > 0;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
      <h1 className="truncate font-heading text-base font-semibold">{titleFor(pathname)}</h1>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={range}
          onValueChange={(value) => value && setRange(value as OpsRange)}
          aria-label="Zaman aralığı"
        >
          {OPS_RANGES.map((option) => (
            <ToggleGroupItem key={option} value={option} className="px-2 sm:px-3" aria-label={RANGE_LABELS[option]}>
              <span className="sm:hidden">{RANGE_SHORT_LABELS[option]}</span>
              <span className="hidden sm:inline">{RANGE_LABELS[option]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={live} onCheckedChange={setLive} aria-label="Canlı yenileme" />
          <span className="flex items-center gap-1.5">
            <StatusDot state={live ? "live" : "unknown"} pulse={live && fetching} />
            <span className="sr-only sm:not-sr-only">{live ? "Canlı" : "Durduruldu"}</span>
          </span>
        </label>
      </div>
    </header>
  );
}
