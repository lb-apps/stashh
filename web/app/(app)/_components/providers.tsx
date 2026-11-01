"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/lib/auth/session";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n";
import { PlatformProvider, type Platform } from "@/lib/platform/provider";
import { StashhApiError } from "@/lib/stashh/api";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // An auth failure won't fix itself on retry; the session gate handles it.
        retry: (count, error) => !(error instanceof StashhApiError && error.isUnauthorized) && count < 2,
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
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </SessionProvider>
      </I18nProvider>
    </PlatformProvider>
  );
}
