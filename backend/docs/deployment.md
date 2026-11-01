# Backend in production

The backend runs as the `backend` container of the root `compose.yaml`: the image compiles
`src/` with `tsc` and starts `node dist/start.js`. How the stack is deployed, and how
`home-server` deploys it on every push, is in [docs/deploy.md](../../docs/deploy.md). This page is what
is specific to the backend process.

## Process topology

[`src/start.ts`](../src/start.ts) runs the HTTP API **and** the recognition worker in one
process (`npm start` after `npm run build`). That is the default and is enough at current volume.

To scale extraction independently, run a second container from the same image with
`node dist/index.js` (API only) and `node dist/modules/recognitions/worker.js` (worker only).
Workers coordinate through Postgres (`claim_recognitions` uses `FOR UPDATE SKIP LOCKED`), so
any number can run side by side.

Workers wake on Supabase Realtime changes to `recognition_tasks` and fall back to polling
(`RECOGNITIONS_POLL_MAX_MS`) if Realtime is unavailable.

## Environment

Validated at boot by [`src/config.ts`](../src/config.ts); the process exits on a bad value.
[`.env.example`](../.env.example) lists every variable with comments.

Required: `OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. `OPENROUTER_MODEL` defaults to
`google/gemini-3.8-flash`; any replacement must accept video input and structured outputs.

Internal API (the Instagram channel and the ops dashboard): `INTERNAL_API_TOKENS` —
comma-separated, each ≥ 32 chars. List the old and new token together while rotating, then
drop the old.

`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` name the test user the ops dashboard's link tester acts
as (`GET /internal/v1/ops/test-user-token`, behind the service token). Optional. The
unauthenticated `GET /dev/token` serves the same token for local tooling and answers 404 when
`NODE_ENV=production`.

`NODE_ENV=production` (set by compose) switches logging to JSON lines; `pino-pretty` is a dev
dependency and is not in the image.

## Verify a deploy

1. `GET /health` → `200`.
2. `GET /openapi.json` lists the public (`/api/v1`) and internal (`/internal/v1`) operations.
3. `POST /api/v1/recognitions` with a user JWT → `202`; logs show the worker claiming it
   and the task moving `queued → processing → completed | failed`.
4. `PUT /internal/v1/channel-identities/instagram/<id>` with the service token → `201`
   then `200` on repeat; without it → `401`.
