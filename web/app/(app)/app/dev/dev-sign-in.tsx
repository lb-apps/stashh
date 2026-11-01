"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/auth/supabase";
import { devSignIn } from "./actions";

/** Development only: opens the app as the backend's test user. */
export function DevSignIn() {
  const router = useRouter();
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const tokens = await devSignIn();
      if (tokens) await supabase().auth.setSession(tokens);
      router.replace("/app");
    })();
  }, [router]);

  return null;
}
