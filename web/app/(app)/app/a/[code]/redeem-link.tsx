"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BrandMoment } from "@/lib/discovery/components/BrandMoment";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { signInWithTokenHash } from "@/lib/auth/session";
import { useT } from "@/lib/i18n/provider";
import { SignedOut } from "../../../_components/signed-out";
import { redeem } from "./actions";

/** Turns a DM link's one-time code into a session, then opens the map. */
export function RedeemLink({ code }: { code: string }) {
  const t = useT();
  const router = useRouter();
  const [failed, setFailed] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    // Strict Mode runs effects twice in development; the code is single-use.
    if (started.current) return;
    started.current = true;
    (async () => {
      const result = await redeem(code);
      if (result.ok && (await signInWithTokenHash(result.tokenHash))) {
        router.replace("/app");
      } else {
        setFailed(true);
      }
    })();
  }, [code, router]);

  if (failed) return <SignedOut variant="expired" />;
  return <BrandMoment object={<GlossyObject tint="cobalt" size={160} />} headline={t.auth.signingIn} style={{ height: "100%" }} />;
}
