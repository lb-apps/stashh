"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { isTerminal, type RecognitionAccepted, type RecognitionStatus } from "@/lib/recognize-types";

/** A recognition normally takes 10–60 s; this keeps the lifecycle visibly moving. */
const POLL_MS = 2_000;

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as T;
}

export function useStartRecognition() {
  return useMutation({
    mutationFn: async (input: { sourceUrl: string; bypassCache: boolean }) =>
      readJson<RecognitionAccepted>(
        await fetch("/api/ops/recognize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source_url: input.sourceUrl, bypass_cache: input.bypassCache }),
        }),
      ),
  });
}

/** Polls one recognition until it reaches a final state; nothing is kept beyond this page. */
export function useRecognitionStatus(id: string | null) {
  return useQuery({
    queryKey: ["recognize", id],
    queryFn: async () => readJson<RecognitionStatus>(await fetch(`/api/ops/recognize/${id}`, { cache: "no-store" })),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isTerminal(status) ? false : POLL_MS;
    },
    staleTime: 0,
    gcTime: 0,
  });
}
