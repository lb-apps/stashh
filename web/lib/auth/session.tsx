"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type SessionState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; session: Session };

const SessionContext = React.createContext<SessionState>({ status: "loading" });

/** Mirrors Supabase's auth state (an external store) into React. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SessionState>({ status: "loading" });

  React.useEffect(() => {
    const toState = (session: Session | null): SessionState =>
      session ? { status: "signed-in", session } : { status: "signed-out" };
    const { data } = supabase().auth.onAuthStateChange((_event, session) => setState(toState(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  return React.use(SessionContext);
}

/** Exchanges the single-use `token_hash` redeemed from a DM link for a session. */
export async function signInWithTokenHash(tokenHash: string): Promise<boolean> {
  const { error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  return !error;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}
