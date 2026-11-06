"use client";

import * as React from "react";
import { identify, setProfile, startAnalytics } from "@/lib/analytics/analytics";
import { useSession } from "@/lib/auth/session";
import { useMe } from "@/lib/stashh/queries";

/**
 * Keeps Mixpanel (an external system) in step with the session: loads it on
 * mount, names the user once signed in, and fills the profile from /me.
 * Sign-out's reset belongs to the sign-out action, not to this mirror — a
 * visitor who was never signed in keeps one device id.
 */
export function AnalyticsSession() {
  const session = useSession();
  const userId = session.status === "signed-in" ? session.session.user.id : null;

  React.useEffect(() => startAnalytics(), []);

  React.useEffect(() => {
    if (userId) identify(userId);
  }, [userId]);

  return userId ? <AnalyticsProfile /> : null;
}

/** Mounted only with a session, so /me is never asked for anonymously. */
function AnalyticsProfile() {
  const me = useMe().data;

  React.useEffect(() => {
    if (me) setProfile({ name: me.display_name, instagramUsername: me.instagram_username, createdAt: me.created_at });
  }, [me]);

  return null;
}
