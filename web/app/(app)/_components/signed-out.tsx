"use client";

import { BrandMoment } from "@/lib/discovery/components/BrandMoment";
import { ButtonLink } from "@/lib/discovery/components/Button";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { useT } from "@/lib/i18n/provider";
import { usePlatform } from "@/lib/platform/provider";

const INSTAGRAM_DM = "https://ig.me/m/stashh.me";

/**
 * No session: the map is reached from the DM, so this screen sends the reader
 * there. One object, one line, one action — brand mode throughout.
 */
export function SignedOut({ variant }: { variant: "signed-out" | "expired" }) {
  const t = useT();
  const { inAppBrowser } = usePlatform();

  return (
    <BrandMoment
      object={<GlossyObject tint="cobalt" size={160} />}
      headline={variant === "expired" ? t.auth.linkExpiredTitle : t.auth.signedOutTitle}
      sub={variant === "expired" ? t.auth.linkExpiredBody : t.auth.signedOutBody}
      action={
        inAppBrowser === "instagram" ? null : (
          <ButtonLink href={INSTAGRAM_DM} variant="onBrand" size="lg">
            {t.auth.openInstagram}
          </ButtonLink>
        )
      }
      style={{ height: "100%" }}
    />
  );
}
