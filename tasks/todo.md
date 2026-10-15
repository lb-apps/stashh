# Stashh Recognition v2 — carousels, stories, honest matching

Plan written 2026-10-15 from the diagnosis of the DM shares that found nothing. Not started;
awaiting the owner's go. Branch `feature/recognition-quality` from `origin/develop`, in a
worktree at `.claude/worktrees/feature-recognition-quality` (the main checkout holds another
session's uncommitted `feature/ops-dashboard` work). `node_modules` symlinked from the main
checkout for `backend/` and `instagram/`.

**Goal.** Every Reel, post, story or link shared with Stashh finds the venues it names: every
carousel slide is read, stories are read, a match is a business and never a street, and a
DM-shared list post we cannot read asks for its link instead of answering "nothing found".

**Language.** Content is global: captions, on-screen text, venue names, cities and scripts
in any language. Nothing in the pipeline may assume Turkish or Turkey — no `regionCode`, no
`locationBias`, no Turkish word lists; the model judges meaning, string code handles any
script. The DM reply copy is Turkish-only today (`copy.tr.ts`); whether replies follow the
sender's language is question 5 below (package F).

**Evidence.** 3 of 7 DM-shared photo posts returned 0 places; all three covers are list
titles ("15 mekan", "favori kahvaltı mekanları") with the names on later slides. Meta's
webhook delivers only a carousel's first image and no permalink, so the DM path cannot read
the rest. The downloader (`igdl`) returns every slide of a permalink, each 4×. Places text
search returned "Sofyalı Sk. No:9" (a street) for Sofyalı 9 and "Tarihi Yeldeğirmeni Sokak"
for a venue. One story share was answered "unsupported" although its CDN URL was in the payload.

**Out of scope.** Logged-in scraping, new third parties, iOS (paused), public API shape
changes beyond additive fields, the ops dashboard (reads new columns only if present).

## A. Honest place matching — backend, ~½ day

- [x] `GooglePlacesClient.searchText(query, { maxResultCount: 3 })` returns the candidate list;
      field mask adds `places.types`, `places.primaryType`, `places.formattedAddress`
- [x] `place-text-search.ts`: query = `name, location_hint`; drop candidates whose `types` hit
      `route`, `street_address`, `locality`, `sublocality*`, `neighborhood`,
      `administrative_area_level_*`, `postal_code`, `premise`, `plus_code`, `country`; among the
      rest pick the best name similarity, script-agnostic: NFKD, strip combining marks, casefold
      with the Turkish İ/ı special case, Dice over character bigrams so Greek, Cyrillic, Arabic
      and CJK names work without tokenisation; below the floor → `null` (a miss beats a wrong pin)
- [x] Prompt: `location_hint` = "city, country" in the post's own language when the post says
      or shows it; the query carries the region, never a hard `regionCode` or `locationBias`
- [x] Tests: fake client returning a street then the venue; Touché vs "Zorlu Performing Arts
      Center" rejected; normalisation cases in Turkish, Greek (ΡΑΝΤΙΚΑΛ kitchen, Athens),
      German umlauts, Arabic and Japanese; the Manchester "Cafe Istanbul" result still matches
- [x] Found while building: Text Search reads "Sofyalı 9" as an address in every form, so the
      model now also gives the venue's category and street address; an address is geocoded and
      the businesses within 75 m are checked by name first (Nearby Search), and the text search
      retries with the category word. Sofyalı → Sofyalı Meyhane (No:7), Forno di Roma by address
- [x] Live: re-run the Sofyalı DM share with `bypass_cache` → "Sofyalı 9"

## B. Carousels on the permalink path — backend, ~1 day

- [ ] `SourceContent.media: Array<{ url, thumbnail_url }>` (first item keeps feeding
      `recognition_results.video_url`); `fetch_method` unchanged
- [ ] `instagram-scraper.ts`: dedupe the downloader list by the decoded CDN path (fallback:
      thumbnail), keep order, cap at `RECOGNITIONS_MAX_MEDIA` (default 12); a single playable
      video from the HTML keeps today's path
- [ ] `ai-analyzer.ts`: download every item (bounded parallelism), one model call with
      `"Slide i of N"` text parts between media parts; prompt says the post is a carousel of N
      slides, names often sit as on-image text in any language, the caption may only introduce
      the list, return every featured venue; byte budget (default 40 MB) drops video slides
      beyond the first two
- [ ] Keep `Accept-Language: en-US` on the HTML fetch: the og:description wrapper
      (`<likes> - <user> on <date>: "…"`) is localised by that header and `extractCaption`
      parses the English form; the caption inside stays in its own language
- [ ] Response schema `source` enum → `caption | video | both` (matches `ExtractedPlace`)
- [ ] `recognition_runs.media_count` (migration `add column if not exists`, coordinated with
      `20261014190000_platform_content_types.sql` on `feature/ops-dashboard`, which adds the
      same column); `buildRunRecord` writes it
- [ ] Tests: dedupe; part assembly and cap with a stubbed OpenRouter (pattern of
      `openrouter.test.ts`); existing `shared-media` tests still green
- [ ] Live: a 4-slide carousel permalink → `media_count = 4`, venues from slides 2–4

## C. Story shares — instagram + backend, ~½ day

- [ ] `intent.ts`: `ig_story` (`story_media_url`, `story_media_id`) and `story_mention`
      (`payload.url`) → `instagram_media` with `format: "story"`; `ig_post` keeps `"post"`
- [ ] `client.ts` → `shared_media.format`; backend `sharedMediaSchema.format` (`post | story`,
      default `post`); `service.ts` key `instagram-story:<id>`, `source_type: "story"` (the
      results check already allows it)
- [ ] Worker: no cover copy for stories (Meta: story media is never stored on our server)
- [ ] `copy.tr.ts`: `SourceKind` gains `story` ("hikâyede" / "hikâyeyi"); `help` and
      `unsupported` name stories
- [ ] Tests: intent for both attachment types, processor reply noun, backend schema and key
- [ ] Live: share a story to @stashh → places or an honest empty

## D. DM-shared list posts ask for the link — backend + instagram, ~½ day

- [ ] Model schema gains `names_elsewhere: boolean` — true when the post announces several
      venues (a list, a route, "10 places", "15 mekan", "les 5 meilleures adresses") whose
      names are not in the media or caption given; judged by the model, in any language
- [ ] `recognition_results.names_elsewhere boolean not null default false` (migration);
      `presentRecognition` exposes it; `instagram/src/stashh/client.ts` schema reads it
- [ ] Processor: completed + 0 places + `names_elsewhere` + source is a DM post →
      `copy.listNeedsLink` (draft: "Bu bir liste gönderisi, diğer sayfalarını göremiyoruz.
      Gönderinin linkini paylaşırsan hepsini çıkaralım: Paylaş → Bağlantıyı kopyala."), in the
      reply language once F decides it; the link then runs through B
- [ ] Cache: `getCachedResultId` ignores results with 0 places, so a re-share re-runs
      (the three empty rows heal on their next share)
- [ ] Tests: processor branch; cache lookup skips empties
- [ ] Live: re-share one of the three list posts → link request; send its link → full list

## E. Scrape hygiene (optional, from the blocking-risk review) — backend, ~½ day

- [ ] Deterministic fetch failures (404, no og tags, unsupported URL) fail without retries;
      network errors keep the 3 retries
- [ ] Login-wall signal = redirect to `/accounts/login/` or no `og:title`, not the substring
- [ ] In-process breaker: 3 login walls in 10 min → skip HTML fetch for 30 min, downloader only
- [ ] DM Reels pass the DM `title` with the URL as a fallback caption, so the breaker costs
      no caption
- [ ] Question for the owner: keep DM-shared covers in the public `source-thumbnails` bucket?

## F. Reply language (only if the owner wants it) — instagram, ~½ day

- [ ] Pick the reply language per message: the sender's own text if any, else the shared
      caption's language (model-reported `language` field added to the analysis schema), else
      English; Turkish only on a Turkish signal
- [ ] `copy.en.ts` as the file's doc comment intends (a second language is a copy of the
      file); `copy(lang)` selects; erase command accepts "sil" and "delete" in both
- [ ] Tests: language pick per source; both copies cover every key
- [ ] Live: an English caption shared from a non-Turkish account → English reply

## Order and checks

A → C → B → D → E. Each package: `npm test` in `backend/` and `instagram/`, `npm run build`,
then the live check against the local backend (`cd backend && npm run dev`, Instagram
channel on :3002) with the real cases listed above; the ops dashboard shows `media_count`
and the run outcome. Commit per package, PR to `develop`.

## Questions before starting

1. Slide cap 12 and "first two videos" — fine, or lower for cost?
2. Empty results no longer served from cache — fine?
3. The link-request copy above — wording OK?
4. E.5 (DM covers in a public bucket) — keep, make private, or drop?
5. Replies: stay Turkish for everyone, or follow the sender's language (package F)?

---

# Stashh Ops v3 — English UI, native shadcn, Discovery console kit

- [x] English everywhere (en-US formats, labels, route `/recognitions`, `lang="en"`)
- [x] Native shadcn only: Item, Avatar, AspectRatio, Card, Collapsible, Label, chart step bar
- [x] Design source found: Claude Design → Discovery Design System → `ui_kits/web_console`
      ("Recognition runs"). Tokens were already identical (7/8 files byte-equal; fonts.css
      differs on purpose — SF Pro is never self-hosted). The gap was the component language.
- [x] Theme: type/radius/depth/gloss utilities, `micro-label`, `numeric`, `fill-primary`;
      `cn` configured for Discovery's scales; typography + spacing tokens imported
- [x] Primitives restyled (button, badge, card, table, tabs, toggle, input, select, sidebar,
      sheet, switch, item, skeleton, alert, empty, chart tooltip)
- [x] Shell: kit sidebar + in-page header (display title, helper, range + live)
- [x] Runs: search + segmented filters, table in a white card; detail opens as a dialog (owner: not docked)
- [x] Bug the owner spotted: emoji in captions were boxes — `fromCharCode` truncated
      `&#x1F4CD;` to U+F4CD. Fixed with `fromCodePoint` + tests; 13 stored captions repaired
      and the trailing `".` wrapper trimmed (migrations 20261014170000/170100)

## Review
- ops typecheck, lint, build clean; backend 69 tests pass
- Browser, fresh tab: Overview, Recognitions (docked at 1440, Sheet at 1024), Instagram —
  no console errors, no hydration mismatch (live dot reads fetching with a false server
  snapshot); 375px no horizontal overflow
- Contrast: micro 5.31 on white / 4.54 on bone; done badge 6.87; amber badge 4.88
- Keyboard: solid 3px cobalt outline on nav, range, switch, search, rows; sparklines no
  longer take focus

# Stashh Ops v2 — back office (every request visible, richer KPIs, shadcn charts)

Plan: `~/.claude/plans/sunny-zooming-meerkat.md` (approved). Branch `feature/ops-dashboard`.

- [x] A Capture: source covers (bucket `source-thumbnails`), `fetch_method`, og:image / igdl / ttdl thumbnails
- [x] B Backend stats v2 (previous window, richer series, source/channel mix, quality, users, library, top places/errors, fetch methods) + list/detail RPCs + `GET /ops/recognitions/:id` + in-memory API health
- [x] C Instagram stats v2 (previous, DM content mix, outcomes, new vs returning, reply series) + webhook counters
- [x] D UI: dashboard-01 section cards with trend + sparkline, interactive bar, gradient area, donuts, radial gauges, multi-line, stacked/horizontal bars, TanStack (v9) recognition table + cover gallery, detail Sheet (`?id=`)
- [x] E Verify: backend 66, instagram 62 tests; ops lint + build; fresh Reel + TikTok → covers stored, fetch method recorded; detail sheet; desktop 1440 + 375 px; no console errors

### Review
- Found while verifying: Suspense around a page whose data the sidebar also fetches caused a
  hydration mismatch → Suspense now wraps only the `?id=` reader. Bar animations replayed on every
  5 s refresh and hid value labels → charts no longer animate. Horizontal bar names inside short
  bars collided with values → names moved to the axis.
- The Supabase MCP auto-declines "destructive" statements: `drop policy if exists` in a migration
  made it refuse; a new bucket needs no drop.
- Old results have no cover (they predate the column); they show a type icon until re-run.

---

# Stashh Ops — local system dashboard (`ops/`)

Plan: `~/.claude/plans/sunny-zooming-meerkat.md` (approved 2026-10-14). Branch `feature/ops-dashboard`.

- [x] 1a Backend metrics: `recognition_runs` (one row per worker attempt), task-logger timings, OpenRouter usage + cost
- [x] 1b Instagram metrics: `intent` + `finished_at` (constraint: final status ⇔ finish time)
- [x] 2a Backend `GET /internal/v1/ops/recognitions` + `recognition_ops_stats()` (service role only)
- [x] 2b Instagram `GET /ops/stats` behind `OPS_API_TOKENS` + `instagram_ops_stats()` + in-process state
- [x] 3 `ops/` app: Next 16.4 + shadcn (radix-nova) on Discovery tokens; Genel bakış / Tanımalar / Instagram
- [x] 4 Docs + wiring: CLAUDE.md (ops section, ports), launch.json `ops`, env examples, local tokens
- [x] 5 Verify: backend 59, instagram 61 tests; ops lint + build; live runs recorded; browser checked
      at desktop and 375 px

### Review
- **Regression found by the new metrics and fixed** (`3004004`): the shared-media change chose
  video/image from Content-Type only; Instagram's video CDN sends `application/octet-stream`, so
  every fresh Reel failed. Now falls back to the file signature. Was on `develop` since PR #1.
- Live numbers after the fix: fresh Reel 30.8 s (fetch 4.9 / model 23.2 / match 1.3 /
  thumbnails 1.2 / save 0.1), 1,659 tokens, $0.0016; cache hit 394 ms.
- Design: Discovery tokens imported from `web/` (not copied); grey-800 for muted text and
  status colours only as marks (contrast); `depth-card` shadow utility (Tailwind's shadow scale
  cannot take a var(), and `shadow-card` collides with the shadow-colour namespace).
- Open: the Instagram scraper failed attempts 2–4 on one Reel ("Could not extract video URL",
  likely rate limiting) — visible now under "Hatalar adıma göre".

---

# Instagram DM channel (`instagram/`) — Stashh goes live through Instagram

## ▶ Resume here — handoff 2026-10-14 (new session: Supabase/Railway/Cloudflare/Meta MCPs loaded)

**State:** branch `feature/instagram-dm-channel`, PR https://github.com/lb-apps/stashh/pull/1
(→ develop, 4 commits). Uncommitted: Phase 3 work-in-progress files under `instagram/src/`
(events, intent, stashh client, graph client, text) + fixtures + this plan. `.captures/` holds
raw webhook bodies (real ids, gitignored) — delete after fixtures are final.

**Live infrastructure**
- Meta app **Stashh** `4523750807883075` (Live, Standard Access) · Instagram app Stashh-IG
  `2320260325466973` · account **stashh.me** (BUSINESS) user_id `17841429946098008`,
  Instagram Tester role (pending accept). Webhook → `https://ig-dev.stashh.me/webhooks/instagram`,
  fields `messages` + `messaging_postbacks`; account subscribed via `POST /me/subscribed_apps`.
- `instagram/.env` (gitignored): `INSTAGRAM_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`,
  `INSTAGRAM_ACCESS_TOKEN` all set. Never print them.
- Tunnel `stashh-ig-dev` (`npm run tunnel` in `instagram/`), cert in `~/.cloudflared/`.
- stashh.me: Cloudflare DNS → Vercel project `stashh` (team Little Big Apps), live with
  /privacy and /data-deletion.

**Done this session (2026-10-14, afternoon)**
- Applied `channel_identities` + `instagram_channel` migrations to Supabase; advisors clean
  (only the intended "RLS on, no policy" infos). `claim_instagram_messages` verified in a
  rolled-back transaction (lease + SKIP LOCKED, no anon/authenticated execute).
- Regenerated `backend/src/types/database.ts` from the live schema (it had been hand-kept);
  fixed the two optional-RPC-arg mismatches it exposed in `places/repository.ts`.
- **Backend models now go through OpenRouter** (`src/lib/openrouter.ts`), not the Gemini SDK.
  Model `google/gemini-3.8-flash` (newest Flash; `gemini-2.5-flash` retires on OpenRouter
  2026-10-20), video as base64 `video_url`, strict JSON schema, reasoning effort low.
  `@google/genai` removed; `OPENROUTER_API_KEY` required, `OPENROUTER_MODEL` optional.
- Pre-existing definer-RPC exposure handed to a separate session (task_cc77fa02).

**Done later the same afternoon**
- OpenRouter verified live: uncached Reel `Dd31ojZOgKL` → Forno Di Roma (Moda), ~26 s of model
  time on `google/gemini-3.8-flash`. Unused env keys removed (`GEMINI_API_KEY`, APIHUT,
  `SUPABASE_DB_URL`, `RECOGNITIONS_BYPASS_RESULT_CACHE`, `TEMP_DIR`) and 8 stale
  credential-bearing permission entries dropped from `.claude/settings.local.json`.
- **Phase 3 code complete**: processor, worker, Supabase store, token store (seeded live),
  store sink, copy/compose, config + `start.ts`. 54 tests, typecheck clean.
- `INTERNAL_API_TOKENS` / `STASHH_API_TOKEN` generated and set; channel ↔ backend auth verified.

**Next, in order**
1. **You**: start the tunnel (`cd instagram && npm run tunnel`) — the agent may not open ingress.
2. Phase 4 E2E — **first Reel DM green (2026-10-14 12:34 UTC)**: webhook → queue → identity →
   recognition (cache hit, Forno Di Roma) → text + carousel accepted by Instagram, replied 8 s
   after the DM; our two echoes were filtered. Also green: uncached Reel from a second account
   (18 s), kill + restart mid-job (resumed, no duplicate), shared feed post (6 venues).
   Still to check: a pasted link, "merhaba", "sil".
3. Privacy page: add OpenRouter as processor (content-writer flow, owner's call).
4. Commit (backend OpenRouter + Phase 3) on `feature/instagram-dm-channel`.
5. Phase 5 Railway (backend + instagram services); production webhook callback.

## Context
The iOS app is paused. Stashh's frontend becomes the Instagram DM inbox: a person shares a
Reel / post / story (or pastes a link) to @stashh, we extract the venues and reply in the
same thread with a place carousel — the iPhone result screen, rendered in Instagram.

Two hard facts shape the design (verified against Meta docs + our code):
1. ~~A DM share carries no permalink~~ — **disproved for Reels by a real payload
   (2026-10-14):** `ig_reel.payload.url` is the public permalink, so the backend's URL
   pipeline works unchanged. Meta's docs describe a CDN URL; stories and feed posts are
   still unverified.
2. **Backend only knows Supabase users.** Every route needs a user JWT, there is no
   service-to-service auth, and `recognition_tasks.owner_user_id` is a NOT NULL FK to
   `auth.users`. Instagram senders have no Stashh account.

Decisions taken: replies in **Turkish** (strings centralised for later i18n); dev webhooks
via a **named Cloudflare tunnel on a fixed subdomain**; **Instagram API with Instagram
Login** (graph.instagram.com, no Facebook Page needed).

## Architecture

```
Instagram ──webhook──▶ instagram/ (channel adapter)            backend/ (domain)
                        ├ verify X-Hub-Signature-256            ├ /internal/v1/* (service auth)
                        ├ persist event (dedupe on mid) → 200   │   ├ PUT  channel-identities
                        ├ worker: claim → interpret message     │   ├ POST recognitions (url | media)
                        │   → resolve identity ───────────────▶ │   └ GET  recognitions/:id
                        │   → create recognition ─────────────▶ ├ existing recognition worker
                        │   → poll status (async req-reply) ──▶ │   (Gemini → Google Places)
                        └ compose reply → Send API ──▶ Instagram
```

- **Bounded contexts.** `backend/` owns places, users, recognition. `instagram/` is a channel
  adapter: it owns Meta protocol, conversation state and reply rendering, and talks to the
  backend **only over HTTP**. It never reads backend tables.
- **Durability.** Meta retries for 36h and extraction takes 10–60 s, so the webhook only
  verifies, persists and returns 200. A worker (claim with `FOR UPDATE SKIP LOCKED`, same
  pattern as `claim_recognitions`) drives each message through
  `received → submitted → replied | failed | ignored`. Restarts and deploys lose nothing.
- **Async Request-Reply.** The backend already exposes 202 + status resource; the channel
  polls it with backoff. No backend → channel coupling.
- **Idempotency end to end.** Dedupe on `message.mid` in the channel; the backend accepts an
  `Idempotency-Key` (the mid) per owner on recognition creation.

## Tooling — project MCPs (`.mcp.json`)
`supabase` (migrations, advisors) · `railway` (deploy, env, logs) · `cloudflare` (tunnel,
DNS, WAF skip rule) · `meta-devtools` (webhook subscriptions, test payloads, App Review
status) · `vercel-lba` (web). App *creation* has no MCP tool → done in Chrome.

## Phase 0 — Meta app + tunnel (Chrome + MCPs, you + me)
- [x] Me: create app **Stashh** (App ID 4523750807883075; Instagram app "Stashh-IG",
      2320260325466973) under Little Big Apps, use case "Manage messaging & content on Instagram"
- [x] Permissions: only `instagram_business_basic` + `instagram_business_manage_messages`
      (least privilege — comments permission deliberately not added)
- [x] Publish the app — **Live** since 2026-10-14. https://stashh.me/privacy and
      /data-deletion (Discovery design system, copy drafted by content-writer, reviewed),
      app domain stashh.me, category Lifestyle
- [x] Instagram Tester role → `stashh.me` (the only account this app serves; Meta requires the
      role to generate its token). No separate test accounts or dev/prod app split — the owner
      tests by DMing from a personal account
- [ ] **You**: accept the tester invite as stashh.me; click *Add account* (Generate access
      tokens) and log in as stashh.me; enable *Allow access to messages* in the Instagram app
- [ ] **You**: paste the Instagram app secret into `instagram/.env` (never in chat); the access
      token goes to the DB-backed token store in Phase 3
- [x] stashh.me moved to Cloudflare DNS (you); apex A → Vercel (216.198.79.1, 64.29.17.1)
      and `www` CNAME → Vercel, both DNS-only; Vercel project `stashh` (Little Big Apps,
      `lb-apps/stashh`, root `web/`, prod branch `master`) owns both domains
- [x] Named tunnel `stashh-ig-dev` → `https://ig-dev.stashh.me` → `localhost:3002`
      (`npm run tunnel` in `instagram/`). Verified end to end: handshake 200 + challenge,
      wrong token 403, unsigned POST 401
- [x] Callback `https://ig-dev.stashh.me/webhooks/instagram` verified (v26.0). Fields
      subscribed: only `messages`, `messaging_postbacks` (Meta pre-subscribed comments,
      live_comments, message_edit, reactions, referral, seen — all turned off)
- [x] **Signing secret confirmed:** Meta's test delivery verified against the *Instagram app
      secret*. Note: the dashboard Test tool sends `entry[].changes[]`; real DMs are documented
      as `entry[].messaging[]` — the parser must accept both

## Phase 1 — Capture real payloads (gate before building ingestion)
- [x] Minimal `instagram/` skeleton: GET handshake + signed POST that logs raw bodies
      (Node 24 native TS, Express 5, Zod 4, vitest — 9 tests)
- [x] **Reel captured** (scrubbed fixture `instagram/test/fixtures/ig-reel-share.json`).
      Shape: `entry[].messaging[].message.attachments[{ type: "ig_reel", payload: { url,
      reel_video_id, title } }]`. **`payload.url` is the public permalink**
      (`https://www.instagram.com/reel/<code>/`), not a CDN link, and `title` is the caption.
      → Reels go through the backend's existing URL pipeline; no media source type needed.
- [x] Signing secret = **Instagram app secret** (Meta test delivery verified).
      Dashboard Test tool sends `entry[].changes[]` (`dashboard-test-messages.json`).
- [x] **Feed posts (2026-10-14)** — `ig_post` carries **no permalink**: `payload.url` is a
      signed `lookaside.fbsbx.com` CDN link (image/jpeg for a photo post), plus `title`
      (caption) and `ig_post_media_id`. Instagram Login cannot resolve another account's media
      id (`code 100 / subcode 33`). → New source kind **shared media**: the channel sends
      `{ shared_media: { media_id, media_url, caption } }`; the task is keyed
      `instagram-media:<id>` (result cache survives the CDN link expiring) and carries its
      content in `recognition_tasks.source_media`; the analyzer picks video/image by
      Content-Type. Verified live: müdavimmet jazz list → 6/6 venues + handles, ~10 s; repeat
      → cache hit. Fixture `ig-post-share.json`.
      Known limits: carousel posts read only the cover item; a backend retry after the CDN
      link expires fails (apology); pasted image-only `/p/` links still fail in the scraper.
- [ ] *Deferred by the owner:* stories (capture the shape first)

## Phase 2 — Backend: internal API
- [x] **Service auth**: `createServiceAuth` middleware — Bearer service token, SHA-256 +
      `timingSafeEqual`, token(s) from `INTERNAL_API_TOKENS` env; mounted on `/internal/v1`;
      own rate limit; not reachable with a user JWT and vice versa
- [x] **Channel identities** migration `20261014120000_channel_identities.sql` (**not yet
      applied**). `PUT` resolves-or-creates, `DELETE` erases (auth.users cascade). Admin
      `createUser` refuses users without email/phone (verified live), anonymous sign-in would
      open a public surface → **UUIDv5-derived id** + reserved never-mailed address
      `instagram-<id>@identities.stashh.me`, pre-confirmed
- [~] ~~Recognition media sources~~ — not needed for Reels (permalink). Revisit with stories.
- [x] `POST /internal/v1/users/:userId/recognitions` (+ `Idempotency-Key`, unique per owner,
      race returns the winner) and `GET /internal/v1/users/:userId/recognitions/:id`;
      `recognitions/factory.ts` + shared `presenter.ts`
- [x] OpenAPI: internal routes under an "Internal" tag (own server + `ServiceToken`)
- [x] Fixes: story-link validation, typed worker steps, worker→service layering, thumbnail
      failures logged, `backend/docs/deployment.md` replaces the stale Railway doc
- [x] vitest for the backend — 28 tests

## Phase 3 — `instagram/` service (Reels + pasted links)
Done (typechecked, **not yet unit-tested, uncommitted**):
- `src/conversation/events.ts` — Zod + `extractInboundMessages()`: accepts `messaging[]`
  and `changes[]`, drops echoes (`is_echo` / `sender.id == entry.id`), deletions, non-messages
- `src/conversation/intent.ts` — `interpret()` → `recognize{sourceUrl}` (ig_reel permalink or
  first IG/TikTok link in text) | `erase` ("sil"/"delete", tr-lowercased) | `unsupported` | `help`
- `src/stashh/client.ts` — `HttpStashhApi` for `/internal/v1` (resolve/erase identity,
  create/get recognition), typed `StashhApiError.retryable`
- `src/meta/graph-client.ts` + `meta/text.ts` — `InstagramMessenger` (text, generic-template
  carousel, `typing_on`), all Send API limits enforced (1000 UTF-8 bytes, 80-char
  title/subtitle, ≤10 cards, ≤3 buttons, grapheme-safe truncation), `GraphApiError.retryable`

To do, in order:
- [x] Migration `20261014130000_instagram_channel.sql` — **applied** (tables owned by the
      channel; RLS on, no policies = service role only). As built: also `text`, `attachments`,
      `submitted_at`, `replies_sent` columns; status set has no `ignored`:
      - `instagram_messages(mid pk, account_id, sender_id, sent_at, payload jsonb, status
        check in (received, submitted, replied, ignored, failed, expired), user_id uuid,
        recognition_id uuid, attempts int, next_attempt_at, locked_until, last_error,
        created_at, updated_at)` + partial index on `next_attempt_at` for open statuses.
        No FK to backend tables (bounded context).
      - `claim_instagram_messages(p_limit, p_lease_seconds)` — `FOR UPDATE SKIP LOCKED`,
        sets `locked_until`; execute revoked from public/anon/authenticated.
      - `instagram_accounts(account_id pk, access_token, expires_at, refreshed_at, updated_at)`
- [x] `src/db/` supabase-js service client (+ hand-written types for the two tables)
- [x] `webhooks/db-sink.ts` — `extractInboundMessages` → insert `on conflict (mid) do nothing`;
      production sink (CaptureSink stays dev-only, optionally alongside)
- [x] `meta/token-store.ts` — `AccessTokenSource` backed by `instagram_accounts`; bootstrap
      from `INSTAGRAM_ACCESS_TOKEN` when the row is missing; daily refresh via
      `GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token` when
      < 30 days left and token ≥ 24h old. **Current token issued 2026-10-14 → expires ~2026-12-13.**
- [x] `replies/copy.tr.ts` (Discovery voice: plain, warm, "sen", **no emoji**, no "!"):
      intro "Bu Reel'de {n} mekân var." · empty "Bu Reel'de bir mekân bulamadık. Başka bir
      Reel gönder, içindekileri çıkaralım." · help "Bir Reel gönder, içindeki mekânları sana
      listeleyelim. Verilerini silmek için sil yaz." · unsupported "Şimdilik yalnızca Reel'leri
      okuyabiliyoruz. …" · failed "Bu Reel'i şu an okuyamadık. Birazdan tekrar gönderir misin?"
      · erased "Stashh'teki verilerini sildik."
- [x] `replies/compose.ts` — places → `[text intro, carousel]`; card: title = name, subtitle =
      `★ 4,6 · {address}` (tr decimal comma), image = `thumbnail_url`, default action + button
      "Haritada aç" = `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=<id>`,
      button "Instagram" when `instagram_username`; >10 places → several carousels
- [x] `conversation/processor.ts` — per-message state machine:
      received → (ignore | erase→reply | help/unsupported→reply | recognize: typing_on,
      resolve identity, create recognition with Idempotency-Key = mid → submitted) ;
      submitted → poll GET (backoff 2s→10s, give up ~5 min) → compose+send → replied |
      failed→apology. Retryable errors back off on `attempts`; > 24h old → expired, no reply.
- [x] `conversation/worker.ts` — claim loop (concurrency 4, idle poll 1s), hourly purge of
      `instagram_messages` older than 30 days (privacy policy), graceful shutdown
- [x] `config.ts` additions: `STASHH_API_URL`, `STASHH_API_TOKEN`, `SUPABASE_URL`,
      `SUPABASE_SECRET_KEY`, `INSTAGRAM_ACCESS_TOKEN` (bootstrap only),
      `GRAPH_API_VERSION=v26.0`; update `.env.example`; `start.ts` wires DB sink + worker
- [x] Tests: events (both fixtures, echo/self filtering), intent, text truncation,
      `toGraphMessage` limits, compose, processor with fake StashhApi + fake Messenger +
      in-memory repo (happy path, empty, failure, retry, duplicate mid, 24h expiry, erase)

## Phase 4 — End-to-end on the dev tunnel
- [ ] Backend (:3000) + instagram (:3002) + tunnel; DM a Reel, post, story and a link from the
      tester account; verify carousel, maps links, empty-result path, retries (kill the
      service mid-job → it resumes), duplicate webhook delivery → one reply
- [ ] Update `CLAUDE.md` repo map + `docs/` with the channel architecture

## Phase 5 — Production (after dev E2E is green)
- [ ] Railway: deploy `backend` (API + worker) and `instagram` as separate services, secrets
      in Railway env, production callback URL
- [x] ~~App Review / Advanced Access / Tech Provider~~ — not needed: the app only ever serves
      our own @stashh account (Standard Access on an asset of the same portfolio). Business
      Verification of Little Big Apps is already complete.

## Out of scope (explicit)
Saving to library from Instagram, lists, multi-account support, non-Turkish replies.
The identity model is built so "Kaydet" can be added later without migration.

---

# Web app boilerplate (`web/`)

## Goal
Add a web project to the Stashh monorepo. Boilerplate only — no page development yet.

## Stack (latest, versions verified via npm on 2026-08-25)
- Next.js 16.3.3 (App Router, Turbopack)
- React 19.2.8
- TypeScript 5
- Tailwind CSS v4.3.3 (mandatory — HeroUI v3 will not work with v3)
- HeroUI v3.2.4 (`@heroui/react` + `@heroui/styles`) + `tailwind-variants`

## Component library ruling
> **Superseded.** HeroUI was removed in favour of the Discovery design system
> (`web/lib/discovery/`). The reasoning below is kept as a record of why a
> second Radix-based kit was rejected — that reasoning still holds, and now
> applies to HeroUI itself.

**HeroUI is the only component library.** It owns design tokens and component base.

shadcn was considered and rejected: HeroUI v3 (React Aria + tailwind-variants) and
shadcn/ui (Radix + CVA) are architecturally incompatible, and HeroUI ships no
shadcn-compatible registry (probed `/registry.json`, `/r/*.json` → 404). Running both
would have doubled the dependency surface for no gain. Nothing shadcn-related was
installed. See [lessons.md](lessons.md).

Components remain fully modifiable — HeroUI's defaults are a starting point, not a cage.

## Steps
- [x] Verify latest versions of every package
- [x] Scaffold `web/` with create-next-app (TS, Tailwind v4, App Router, Turbopack)
- [x] Install HeroUI v3 + tailwind-variants
- [x] Wire `globals.css`: Tailwind first, then `@heroui/styles`
- [x] Map DESIGN.md cobalt (#0138FF) to HeroUI's `--accent`, converted to oklch
- [x] Match Tailwind's `dark:` variant to HeroUI's `.dark` / `[data-theme="dark"]`
- [x] Root layout: no provider (v3 drops it), theme attrs, `suppressHydrationWarning`
- [x] Pin `turbopack.root` so the monorepo lockfile warning goes away
- [x] Move web dev server to :3001 (backend owns :3000)
- [x] Verify: typecheck clean, production build clean, renders light + dark, no console errors
- [ ] Add the web rule to CLAUDE.md
- [ ] Update .gitignore for web build artifacts
- [ ] Replace create-next-app's generated web/CLAUDE.md + AGENTS.md

## Review

**Verified, not assumed:**
- `npx tsc --noEmit` — clean
- `npm run build` — compiles, 4 static routes, no warnings
- Rendered at localhost:3001 in light and dark; HeroUI tokens flip correctly and the
  cobalt override survives both themes
- Zero console errors
- Confirmed Tailwind preflight appears exactly once in the emitted CSS despite
  `@heroui/styles` also importing Tailwind (v4 dedupes the nested import)
- Confirmed the `--accent` override lands last in the cascade, so it beats HeroUI's default

**Deliberately not done:** no pages built, per the brief. `app/page.tsx` is a
throwaway placeholder that exists to prove the wiring compiles and renders.

---

# Recognition Console page (`web/app/page.tsx`)

## Goal
A page to exercise the backend end to end: paste a link, watch each stage, see how
long each took, inspect every response, and read the extracted venues in full.

## Architecture note
The backend runs `cors({ origin: false })` — it rejects every browser origin by design.
So the page never calls it directly. Three Next route handlers proxy server-side
(`/api/health`, `/api/recognitions/start`, `/api/recognitions/status`), which also keeps
the dev access token out of the browser entirely.

## Honesty constraint
Per-stage timings (scrape / Gemini / Places match) are written to the worker's server
log, not exposed by the API. The console therefore reports only what the backend
actually returns — measured HTTP round-trips plus the task's own
created→started→finished spans — and says so in the UI rather than inventing a
stage breakdown.

## Steps
- [x] Capture real response shapes from the running backend before designing
- [x] Server-side proxy + typed client mirror of the API payloads
- [x] Pipeline phase breakdown from task timestamps
- [x] Request log — per-call status, duration, relative bar, expandable raw JSON
- [x] Scraped source panel (caption, source type, resolved video URL)
- [x] Place cards — thumbnail, rating, address, IG handle, coords, Place ID, tips
- [x] Motion pass: custom ease-out, staggered entrances, unanimated live counter
- [x] Verified against a real uncached run and a cached run

## Review

**Verified live, twice:**
- Uncached run of `reel/DaXxOXfMDxK` — 704ms queue, 16.5s processing, 17.2s total,
  11 recorded calls, 1 venue extracted with a Google match
- Cached run of the same URL — 861ms total, 215ms processing, proving the reported
  timings track reality rather than being cosmetic
- Places card renders thumbnail, ★4.4, address, @wizardscoffeehouse, coords, Place ID
- Light and dark both correct; zero console errors
- typecheck, lint, and production build all clean

**Tooling note:** the browser screenshot pipeline froze on programmatic scrolling.
Confirmed via DOM inspection that all 14 animated elements settle at opacity 1 with an
identity transform, so the blank frames were a capture artifact, not a CSS bug.

---

# Console redesign (dark, depth-first)

## Why
User: "çok kötü bir arayüz." Correct. The first pass was light-mode flat boxes —
`ui-ux-pro-max` lists *"Flat design without depth"* and *"Text-heavy pages"* as the
explicit anti-patterns for this product type, and it recommends **dark mode primary**
for developer tools. The old version was both anti-patterns at once.

## Sources
- `ui-ux-pro-max --design-system` (variance 6 / motion 4 / density 8) → pattern
  "Real-Time / Operations", style "Modern Dark", Inter-class type, expo-out easing,
  "avoid pure #000000 (OLED smear)"
- `apple-design` → materials & depth, response on pointer-down, size-specific
  tracking, reduced-motion/transparency/contrast handling

## Palette reconciliation
The DB proposed endpoint-green as accent. Rejected: DESIGN.md owns the brand and
cobalt #0138FF is it. Cobalt stays the accent; green is reserved for success/OK
status only. Dark surface stack taken from the DB.

## What changed
- Dark commit — `data-theme="dark"` on `<html>`, HeroUI's own dark tokens
- Layered surfaces: vertical gradient + bright inset top edge + depth shadow,
  bigger surfaces get heavier shadow. Ambient cobalt glow behind the header.
- **Status hero** — the focal point the old page lacked: large tabular numerals,
  status, and queue/work/requests/venues metrics
- Pipeline became a real stepper: connecting rail, check/pulse nodes, and duration
  bars proportional to the slowest phase (the bottleneck is now visible, not computed)
- Real SVG icons replace the `★` glyph and bare dots — no icon package added
- Caption clamps at 260 chars with a reveal, killing the wall of text
- Type: negative tracking on display numerals, tabular figures, uppercase
  micro-labels for section headings

## Accessibility fix worth recording
A contrast audit over every text node found **4 failures**: cobalt-as-text measured
**2.75:1** on the dark surface. Added `--console-accent-text` (lifted cobalt,
`oklch(0.78 0.1418 264.09)`) exposed as `text-accent-strong`, and dropped the
`text-muted/70` fades. Re-audit: **0 failures across 50 nodes.**

## Review
- Live uncached run: 178ms queue, 20.6s work, 20.8s total, 13 requests, 1 venue
- Running state verified: live counter, pulsing active node, indeterminate sweep
- Mobile 375px: no horizontal overflow, metrics reflow to 2 columns
- typecheck, lint, build all clean; zero console errors
- prefers-reduced-motion / reduced-transparency / contrast-more all handled

---

# AI-tell pass (design-taste-frontend)

## Scope honesty
That skill's Section 13 declares itself out of scope for "dashboards / dense product
UI / admin panels" and instructs the agent to say so. The console is exactly that, so
its landing-page rules (hero viewport, logo walls, bento rhythm, marquees, CTA-intent
dedupe) were NOT applied. Applied instead: Section 9 (AI Tells), Section 3.C (icons),
and the copy discipline, which are surface-agnostic.

## Tells found in my own output, and fixed
1. **Em-dashes (Section 9.G, hard ban).** 6 user-visible instances, including the
   `"-"` null placeholder in `format.ts` that rendered in every empty duration cell.
   Now zero.
2. **Hand-rolled SVG icons (Section 3.C, "NEVER").** I had drawn 8 by hand, including
   a star and an Instagram glyph. Replaced with Phosphor (`@phosphor-icons/react`),
   one family, one weight, re-exported through `icons.tsx` so a future swap is one file.
   Note: an icon library is not a component library, so this does not violate the
   HeroUI-only rule in CLAUDE.md.
3. **Eyebrow overuse (Section 4.7, "#1 violated rule").** Every section heading was
   `uppercase tracking` — the templated rhythm tell. Dropped to plain sentence case.
   Instances went 9 → 1 (the hero metric row, where small caps is a functional field
   label, not decoration).
4. **Decorative status dot** in the request log: the row already encoded success via
   status code and bar colour. Triple encoding removed.
5. **Dark-tech ambient glow** toned from 0.22 to 0.10 alpha and narrowed, so it reads
   as light falloff rather than the default AI mesh blob.
6. **Cute copy** removed: "as the worker moves", "before settling".

## Bug caught during the pass
Phosphor's `IconContext.Provider` replaces defaults wholesale rather than merging.
Passing only `{ weight }` dropped `size`, so the hero bolt scaled to fill its
container. Fixed with `{ weight: "bold", size: "1em" }`.

## Review
- Verified counts: 0 visible em-dashes, 0 hand-rolled SVG paths, 1 uppercase label
- All 18 icons render at 12-14px, none oversized
- Contrast re-audit after the colour changes: **0 failures across 84 nodes**
- Live run: 316ms queue, 12.8s work, 13.2s total, 10 requests, 1 venue
- typecheck, lint, build clean

---

# TikTok source support

## Dependency decision
You linked `BOTCAHX/tiktokdl-api`. That repo is a self-hosted CoffeeScript Express
server exposing `GET /tiktok/api.php?url=`, and it defaults to port 3000, which the
Stashh backend already owns. The same author publishes `btch-downloader`, which
was ALREADY installed here for the Instagram fallback and exports `ttdl` with the
same capability. Used that instead of running a second service. No new dependency.

## What changed
- `tiktok-scraper.ts`: `fetchTikTokContent` via `ttdl`. TikTok's `title` field is the
  caption, so the analyzer gets the same two inputs it gets for Instagram.
- `source-content.ts`: platform router. The worker asks for content and gets a
  normalised `SourceContent`; it no longer knows which platform a task came from.
- `schemas.ts`: `InstagramContent` became `SourceContent`, gained `platform`, and
  `source_type` gained `"tiktok"`.
- Request schema, OpenAPI enum, `database.ts`, and `repository.ts` widened to match.
- Migration `20260825120000_recognition_results_tiktok_source_type.sql`: widened the
  `source_type` CHECK constraint. Verified the live constraint name first so the
  `drop constraint if exists` could not silently no-op. Applied to the project.
- Web console copy now says Source URL and accepts either platform.

## Data-correctness call worth flagging
An @handle in a TikTok caption is a TikTok handle, not an Instagram one. Writing it
into `instagram_username` would store wrong data. `analyzeContent` now takes the
platform and instructs the model to return null for that field on TikTok. Verified:
TikTok result has `instagram_username: null`, Instagram result still has
`wizardscoffeehouse`.

## Review
- `ttdl` verified directly first: HTTP 200, 10.8 MB, magic `ftypisom`, real MP4
- A second TikTok URL returned `status:true` with empty arrays (deleted post), which
  is why the scraper treats an empty video array as a hard error with a clear message
- Rick Roll meme: completed, 0 venues extracted (correct, there are none)
- Real food TikTok (`@shezcooks`): completed, extracted Cafe Istanbul, 79-81 Bridge
  St Manchester, Google match `ChIJ0eC6W22je0gRIDbWHI2OYNE`, 4 creator tips
- Instagram regression: still completes, still extracts Wizards Coffee House Kadikoy
- Boundary: a YouTube URL is still rejected with VALIDATION_ERROR
- End to end through the web console: 425ms queue, 42.8s work, 43.2s total, 24 requests
- backend typecheck, web lint, web build all clean
