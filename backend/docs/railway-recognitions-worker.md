# Railway API + Worker Topology

This project runs two Railway services from the same repository:

1. `api` service
   - Start command: `npm start`
   - Exposes HTTP endpoints (`/health`, `/api/v1/recognitions`, etc.)
2. `recognitions-worker` service
   - Start command: `npm run worker:recognitions`
   - Processes queued rows from `public.recognitions`

## Shared Environment Variables

Set these in both services:

- `SUPABASE_URL`
- `SUPABASE_DB_URL` (recommended for low-latency LISTEN/NOTIFY wakeups)
- `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_PLACES_API_KEY`

## Worker-specific Environment Variables

Recommended baseline:

- `RECOGNITIONS_WORKER_CONCURRENCY=2`
- `RECOGNITIONS_CLAIM_BATCH_SIZE=2`
- `RECOGNITIONS_POLL_MIN_MS=1500`
- `RECOGNITIONS_POLL_MAX_MS=5000` (fallback delay if Realtime does not wake the worker; lower = snappier idle polling)
- `RECOGNITIONS_CLAIM_TIMEOUT_MS=900000`

## Health/Verification Checklist

1. `api` service responds on `/health`.
2. `POST /api/v1/recognitions` returns `202` with `recognition_id`.
3. Worker logs show:
   - startup message
   - realtime subscription connected
   - completion or retry/failure per recognition
4. `GET /api/v1/recognitions/:id` reflects transitions:
   - `queued` -> `processing` -> (`completed` | `failed`)
