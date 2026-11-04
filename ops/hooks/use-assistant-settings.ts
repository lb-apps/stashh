"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssistantSettings, AssistantSettingsPatch } from "@/lib/ops-types";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as T;
}

const KEY = ["ops", "assistant-settings"] as const;

/** The assistant's settings; refreshed only when the page opens or after a save. */
export function useAssistantSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => readJson<AssistantSettings>(await fetch("/api/ops/assistant/settings", { cache: "no-store" })),
    refetchInterval: false,
  });
}

/** Saves a change and replaces the cached settings with what the backend now holds. */
export function useSaveAssistantSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: AssistantSettingsPatch) =>
      readJson<AssistantSettings>(
        await fetch("/api/ops/assistant/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }),
      ),
    onSuccess: (settings) => client.setQueryData(KEY, settings),
  });
}
