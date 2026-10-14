import type { Json } from "../../types/database.js";
import type { RecognitionTaskRow } from "./types.js";

/** Wire shape of a recognition task. Shared by the public and internal APIs. */
export function presentRecognition(task: RecognitionTaskRow, places: Json | null) {
  return {
    recognition_id: task.id,
    status: task.status,
    source_url: task.source_url,
    result_id: task.result_id,
    places,
    error_message: task.error_message,
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
