/**
 * Transport-layer JSON contract for all API responses (success and error).
 */

export interface ApiPaginationMeta {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiMeta {
  request_id: string;
  pagination: ApiPaginationMeta | null;
}

export interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
  error: null;
}
