"use client";

import { track } from "@/lib/analytics/analytics";
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
export function SignedOut({ variant }: { variant: "signed-out" | "invalid" }) {
  const t = useT();
  const { inAppBrowser } = usePlatform();

  return (
    <BrandMoment
      object={<GlossyObject tint="cobalt" size={160} />}
      headline={variant === "invalid" ? t.auth.linkInvalidTitle : t.auth.signedOutTitle}
      sub={variant === "invalid" ? t.auth.linkInvalidBody : t.auth.signedOutBody}
      action={
        inAppBrowser === "instagram" ? null : (
          <ButtonLink
            href={INSTAGRAM_DM}
            onClick={() => track("instagram_cta_clicked", { surface: variant === "invalid" ? "invalid_link" : "signed_out" }, { leavesPage: true })}
            variant="onBrand"
            size="lg"
          >
            {t.auth.openInstagram}
          </ButtonLink>
        )
      }
      style={{ height: "100%" }}
    />
  );
}
