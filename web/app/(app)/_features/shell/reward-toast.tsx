"use client";

import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { Toast } from "@/lib/discovery/components/Toast";
import { useCopy } from "@/lib/i18n/provider";
import { useEarnedReward } from "@/lib/stashh/rewards";
import { shellCopy } from "./copy";

/** Above the sheets and the create sheet, under the sign-out dialog. */
const LAYER = 60;
/** The gold coin's size in px: the toast's text height. */
const COIN = 32;

/** "You earned 3 credits — for your first list": each reward as it comes in, one after another. */
export function RewardToast() {
  const c = useCopy(shellCopy);
  const [reward, told] = useEarnedReward();

  return (
    <Toast
      message={
        reward
          ? {
              id: reward.id,
              title: c.earned(reward.credits),
              sub: c.earnedFor[reward.task],
              leading: <GlossyObject tint="gold" size={COIN} floating={false} />,
            }
          : null
      }
      onDismiss={() => {
        if (reward) told(reward.id);
      }}
      style={{ zIndex: LAYER }}
    />
  );
}
