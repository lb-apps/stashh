"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, use, useState, type ReactNode } from "react";
import type { OpsRange } from "@/lib/ops-types";

interface OpsControls {
  range: OpsRange;
  setRange: (range: OpsRange) => void;
  /** Live refresh on/off; off freezes every panel on its last snapshot. */
  live: boolean;
  setLive: (live: boolean) => void;
}

const OpsControlsContext = createContext<OpsControls | null>(null);

export function OpsProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 4_000, refetchOnWindowFocus: true, retry: 1 } },
      }),
  );
  const [range, setRange] = useState<OpsRange>("24h");
  const [live, setLive] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <OpsControlsContext value={{ range, setRange, live, setLive }}>{children}</OpsControlsContext>
    </QueryClientProvider>
  );
}

export function useOpsControls(): OpsControls {
  const controls = use(OpsControlsContext);
  if (!controls) throw new Error("useOpsControls must be used inside <OpsProvider>");
  return controls;
}
