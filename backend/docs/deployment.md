# Backend deployment (Railway)

The backend deploys from this monorepo as a Railway service with **Root Directory =
`backend`**, built by Nixpacks ([nixpacks.toml](../nixpacks.toml)): `npm ci` →
`npm run build` → `npm start`.

## Process topology

`npm start` runs [`src/start.ts`](../src/start.ts): the HTTP API **and** the recognition
worker in one process. That is the default and is enough at current volume.

To scale extraction independently, run a second service from the same repo with
`npm run start:api` on the first and `npm run start:worker` on the second. Workers
coordinate through Postgres (`claim_recognitions` uses `FOR UPDATE SKIP LOCKED`), so
any number can run side by side.

Workers wake on Supabase Realtime changes to `recognition_tasks` and fall back to
polling (`RECOGNITIONS_POLL_MAX_MS`) if Realtime is unavailable.

## Environment

Validated at boot by [`src/config.ts`](../src/config.ts); the process exits on a bad value.
[`.env.example`](../.env.example) lists every variable with comments.

Required: `OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. `OPENROUTER_MODEL` defaults to
`google/gemini-3.8-flash`; any replacement must accept video input and structured outputs.

Internal API (needed by the Instagram channel): `INTERNAL_API_TOKENS` — comma-separated,
each ≥ 32 chars. List the old and new token together while rotating, then drop the old.

Never set `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` in production; `/dev/token` returns
404 when `NODE_ENV=production` regardless.

## Verify a deploy

1. `GET /health` → `200`.
2. `GET /openapi.json` lists the public (`/api/v1`) and internal (`/internal/v1`) operations.
3. `POST /api/v1/recognitions` with a user JWT → `202`; logs show the worker claiming it
   and the task moving `queued → processing → completed | failed`.
4. `PUT /internal/v1/channel-identities/instagram/<id>` with the service token → `201`
   then `200` on repeat; without it → `401`.
