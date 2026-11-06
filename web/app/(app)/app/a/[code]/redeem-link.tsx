"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { identify, track } from "@/lib/analytics/analytics";
import { BrandMoment } from "@/lib/discovery/components/BrandMoment";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { signInWithTokenHash } from "@/lib/auth/session";
import { useT } from "@/lib/i18n/provider";
import { SignedOut } from "../../../_components/signed-out";
import { redeem } from "./actions";

/** Turns a DM link's code into a session, then opens the map. */
export function RedeemLink({ code }: { code: string }) {
  const t = useT();
  const router = useRouter();
  const [failed, setFailed] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    // Strict Mode runs effects twice in development; one sign-in is enough.
    if (started.current) return;
    started.current = true;
    (async () => {
      const result = await redeem(code);
      const userId = result.ok ? await signInWithTokenHash(result.tokenHash) : null;
      if (userId) {
        // Named before the event: the session mirror identifies only after this render, and the
        // device may still carry the previous account's id.
        identify(userId);
        track("map_link_opened", {});
        router.replace("/app");
      } else {
        track("map_link_failed", {});
        setFailed(true);
      }
    })();
  }, [code, router]);

  if (failed) return <SignedOut variant="invalid" />;
  return <BrandMoment object={<GlossyObject tint="cobalt" size={160} />} headline={t.auth.signingIn} style={{ height: "100%" }} />;
}
