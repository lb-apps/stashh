"use client";

import * as React from "react";
import { useSession } from "@/lib/auth/session";
import { SignedOut } from "./signed-out";

/** Renders the app only with a session; otherwise the way back to the DM. */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.status === "loading") return null;
  if (session.status === "signed-out") return <SignedOut variant="signed-out" />;
  return children;
}
