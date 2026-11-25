"use client";

import * as React from "react";
import { track } from "@/lib/analytics/analytics";
import type { TaskReward } from "./types";

/**
 * Credits the reader has just earned, waiting to be told. A store outside
 * React, because a reward learned on the sign-in page has to outlive the
 * navigation into the app: both pages sit under one layout, in one document.
 * One reward is told at a time, in the order they were earned.
 */
export interface EarnedReward extends TaskReward {
  id: number;
}

let queue: EarnedReward[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const current = () => queue[0] ?? null;
const none = () => null;

/** Credits just earned: reported once to analytics, and queued to be told. */
export function rewardEarned(reward: TaskReward) {
  if (reward.credits <= 0) return;
  track("credits_earned", { task: reward.task, credits: reward.credits });
  queue = [...queue, { ...reward, id: nextId++ }];
  emit();
}

/** The reward to tell now, and the call that has told it (the next one follows). */
export function useEarnedReward(): [EarnedReward | null, (id: number) => void] {
  const reward = React.useSyncExternalStore(subscribe, current, none);
  const told = React.useCallback((id: number) => {
    queue = queue.filter((r) => r.id !== id);
    emit();
  }, []);
  return [reward, told];
}
