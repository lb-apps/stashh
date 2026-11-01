import { recognitionErrorCode } from "./failure-reason.js";
import type { RecognitionSummaryRow, RecognitionWithResult } from "./repository.js";
import type { RecognitionTaskRow } from "./types.js";

/** Wire shape of a recognition task. Shared by the public and internal APIs. */
export function presentRecognition({ task, places, names_elsewhere }: RecognitionWithResult) {
  return {
    recognition_id: task.id,
    status: task.status,
    stage: task.stage,
    source_url: task.source_url,
    result_id: task.result_id,
    places,
    names_elsewhere,
    error_message: task.error_message,
    error_code: recognitionErrorCode(task),
    retry_count: task.retry_count,
    started_at: task.started_at,
    finished_at: task.finished_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

/** Wire shape of a freshly accepted (202) recognition. */
export function presentAcceptedRecognition(task: RecognitionTaskRow) {
  return {
    recognition_id: task.id,
    status: task.status,
    created_at: task.created_at,
  };
}

/** Wire shape of one recognition in `GET /recognitions`. */
export function presentRecognitionSummary({ task, result }: RecognitionSummaryRow) {
  return {
    recognition_id: task.id,
    status: task.status,
    stage: task.stage,
    // Shared media is keyed `instagram-media:<id>`, not a link.
    source_url: /^https?:\/\//.test(task.source_url) ? task.source_url : null,
    source_type: result?.source_type ?? null,
    source_thumbnail_url: result?.source_thumbnail_url ?? null,
    author_username: result?.author_username ?? null,
    result_id: task.result_id,
    place_count: result?.place_count ?? 0,
    created_at: task.created_at,
    finished_at: task.finished_at,
  };
}
