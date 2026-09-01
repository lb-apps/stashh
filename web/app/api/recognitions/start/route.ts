import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import type { RecognitionTask } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sourceUrl = typeof body?.source_url === "string" ? body.source_url.trim() : "";
  const bypassCache = body?.bypass_cache === true;

  if (!sourceUrl) {
    return NextResponse.json({ error: "source_url is required" }, { status: 400 });
  }

  const call = await callBackend<RecognitionTask>("POST", "/api/v1/recognitions", {
    body: { source_url: sourceUrl },
    // Forces the worker past its result cache so timings reflect a real run.
    ...(bypassCache ? { headers: { "x-bypass-cache": "true" } } : {}),
  });

  return NextResponse.json(call, { status: call.ok ? 200 : 502 });
}
