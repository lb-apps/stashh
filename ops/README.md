# Stashh Ops

Local-only dashboard for the Stashh system: the live recognition queue, processing and wait
times (p50/p95), cache hits, failures by step, model cost, Google match rate, and the Instagram
DM funnel. Never deployed; it binds to `127.0.0.1:3003`.

## Run

```bash
cp .env.example .env.local   # fill in the two tokens (see below)
npm install
npm run dev                  # http://127.0.0.1:3003
```

`STASHH_API_URL` and `INSTAGRAM_API_URL` point at production on `home-server`
(`http://home-server:3000`, `http://home-server:3002`; see [docs/deploy.md](../docs/deploy.md)) or at
local dev servers.

## Tokens

- `STASHH_OPS_TOKEN`: one entry of the backend's `INTERNAL_API_TOKENS`.
- `INSTAGRAM_OPS_TOKEN`: one entry of the Instagram service's `OPS_API_TOKENS`.

Give the dashboard its own entries so they can be revoked without touching the channel's token.

## Recognize a link

The link tester (`/recognize`) sends one link through the backend's public API exactly as
the app does, as the backend's test user (`GET /internal/v1/ops/test-user-token` with the
dashboard's token; the backend needs `DEV_TEST_EMAIL` and `DEV_TEST_PASSWORD`), polls it until
it settles and shows the places.
One recognition at a time; nothing is kept — a reload forgets the run. It replaced the test
page the backend used to serve at `localhost:3000/`.

## Where the numbers come from

- Backend `GET /internal/v1/ops/recognitions` → `recognition_ops_stats()` plus the live queue
  and the latest runs. Run figures start on 2026-10-14, when `recognition_runs` was added.
- Instagram `GET /ops/stats` → `instagram_ops_stats()` plus in-process state and token health.
  Messages are purged after 30 days.

Stack and design rules: see the root `CLAUDE.md` (Ops dashboard section).
