"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/lib/auth/session";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n";
import { LocationProvider } from "@/lib/platform/location";
import { PlatformProvider, type Platform } from "@/lib/platform/provider";
import { StashhApiError } from "@/lib/stashh/api";
import { AnalyticsSession } from "./analytics-session";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // A 4xx won't fix itself on retry (and a 401 is the session gate's job);
        // network and server failures get two more tries.
        retry: (count, error) => !(error instanceof StashhApiError && error.status >= 400 && error.status < 500) && count < 2,
        refetchOnWindowFocus: true,
      },
    },
  });
}

export function Providers({ locale, platform, children }: { locale: Locale; platform: Platform; children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient);
  return (
    <PlatformProvider value={platform}>
      <I18nProvider locale={locale}>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            <AnalyticsSession />
            <LocationProvider>{children}</LocationProvider>
          </QueryClientProvider>
        </SessionProvider>
      </I18nProvider>
    </PlatformProvider>
  );
}
