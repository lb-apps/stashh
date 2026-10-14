import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import { withConsoleGate } from "@/lib/console-gate";
import type { RecognitionResult, RecognitionTask } from "@/lib/types";

export const GET = withConsoleGate(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const status = await callBackend<RecognitionTask>("GET", `/api/v1/recognitions/${id}`);

  // Once the task lands, pull the stored result too — it carries the caption and
  // resolved video URL the task payload leaves out.
  let result = null;
  if (status.data?.result_id) {
    result = await callBackend<RecognitionResult>(
      "GET",
      `/api/v1/recognitions/result?id=${status.data.result_id}`,
    );
  }

  return NextResponse.json({ status, result }, { status: 200 });
});
