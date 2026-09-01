import { NextResponse } from "next/server";

const BACKEND_URL = process.env.STASHH_API_URL ?? "http://localhost:3000";

/** Unauthenticated probe — mirrors the backend's own uptime endpoint. */
export async function GET() {
  const startedAt = performance.now();

  try {
    const res = await fetch(`${BACKEND_URL}/health`, { cache: "no-store" });
    const body = await res.json().catch(() => null);

    return NextResponse.json({
      reachable: res.ok,
      durationMs: Math.round(performance.now() - startedAt),
      timestamp: body?.data?.timestamp ?? null,
      target: BACKEND_URL,
    });
  } catch (cause) {
    return NextResponse.json({
      reachable: false,
      durationMs: Math.round(performance.now() - startedAt),
      timestamp: null,
      target: BACKEND_URL,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
