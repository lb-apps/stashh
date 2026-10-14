# Instagram DM channel (`instagram/`) — Stashh goes live through Instagram

## Context
The iOS app is paused. Stashh's frontend becomes the Instagram DM inbox: a person shares a
Reel / post / story (or pastes a link) to @stashh, we extract the venues and reply in the
same thread with a place carousel — the iPhone result screen, rendered in Instagram.

Two hard facts shape the design (verified against Meta docs + our code):
1. **A DM share carries no permalink.** `ig_reel` / `ig_post` attachments deliver a signed
   `lookaside.fbsbx.com` CDN URL, the caption (`title`) and a media id. The backend today
   only accepts `instagram.com/reel|p/...` permalinks and scrapes them.
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
- [ ] Publish the app (webhooks are only delivered to published apps). Needs: privacy policy
      URL, data-deletion instructions URL, icon, category → `/privacy` and `/data-deletion`
      pages on `web/`, deployed to Vercel on our domain (copy via content-writer)
- [ ] **You**: switch @stashh to a professional account if it isn't one; add it to the portfolio
      (needs Instagram login — I can't enter passwords); in the app's "API setup with Instagram
      login" click *Generate token* and log in; enable *Allow access to messages* in the
      Instagram app; add a second Instagram account of yours as an Instagram Tester
- [ ] **You**: paste the app secret, Instagram app secret and token into `instagram/.env`
      (never in chat)
- [x] stashh.me moved to Cloudflare DNS (you); apex A → Vercel (216.198.79.1, 64.29.17.1)
      and `www` CNAME → Vercel, both DNS-only; Vercel project `stashh` (Little Big Apps,
      `lb-apps/stashh`, root `web/`, prod branch `master`) owns both domains
- [x] Named tunnel `stashh-ig-dev` → `https://ig-dev.stashh.me` → `localhost:3002`
      (`npm run tunnel` in `instagram/`). Verified end to end: handshake 200 + challenge,
      wrong token 403, unsigned POST 401
- [ ] Me: set callback URL + verify token, subscribe `messages, messaging_postbacks`

## Phase 1 — Capture real payloads (gate before building ingestion)
- [x] Minimal `instagram/` skeleton: GET handshake + signed POST that logs raw bodies
      (Node 24 native TS, Express 5, Zod 4, vitest — 9 tests)
- [ ] Share a Reel, a post, a story and a pasted link from the tester account; save the raw
      payloads as test fixtures (`instagram/test/fixtures/`), with PII scrubbed
- [ ] Confirm: attachment types/keys, whether the CDN URL is directly downloadable by
      Gemini, which secret signs the payload, whether `/{media-id}?fields=permalink` works
      on foreign media (if it does, prefer the permalink path)

## Phase 2 — Backend: internal API + media sources
- [x] **Service auth**: `createServiceAuth` middleware — Bearer service token, SHA-256 +
      `timingSafeEqual`, token(s) from `INTERNAL_API_TOKENS` env; mounted on `/internal/v1`;
      own rate limit; not reachable with a user JWT and vice versa
- [x] **Channel identities** migration `20261014120000_channel_identities.sql` (not yet
      applied — needs Supabase MCP). `PUT` resolves-or-creates, `DELETE` erases (auth.users
      cascade). Verified on the live project that Admin `createUser` refuses users without
      email/phone, and anonymous sign-in would open a public surface — so users get a
      **UUIDv5-derived id** (idempotent, race-safe, no orphans) and a reserved never-mailed
      address `instagram-<id>@identities.stashh.me`, pre-confirmed
- [ ] **Recognition sources**: migration adds `source_key` (cache identity: normalised URL or
      `instagram:media:<id>`), `source_media jsonb` and `idempotency_key` to
      `recognition_tasks`; `recognition_results` dedupes on `source_key` (backfilled from
      `source_url`). Request schema becomes a discriminated union
      `{ type: "url", url } | { type: "media", platform, media_id, media_url, caption, kind }`.
      `source-content.ts` resolves `media` sources without scraping
- [x] `POST /internal/v1/users/:userId/recognitions` (+ `Idempotency-Key`, unique per owner,
      race returns the winner) and `GET /internal/v1/users/:userId/recognitions/:id`;
      `recognitions/factory.ts` + shared `presenter.ts`; worker no longer reaches past the
      service into the repository. URL sources only until Phase 1 confirms the media shape
- [x] OpenAPI: internal routes documented under an "Internal" tag (own server + `ServiceToken`)
- [x] Fix what we touch: story URLs pass validation but always fail in the worker
      (validation and `extractShortcode` disagree); worker's `tl.step` smuggles results
      through `_content`/`_analysis` casts → make `step<T>` generic and typed; replace the
      stale `backend/docs/railway-recognitions-worker.md`
- [x] vitest set up for the backend (none existed) — 28 tests: service auth, URL
      validation, idempotency, identity resolve/erase/concurrency

## Phase 3 — `instagram/` service
Same stack as backend for one toolchain: Node 20+, TypeScript strict, Express 5, Zod, pino,
vitest, Railway via nixpacks.

```
instagram/src/
  config.ts                 Zod-validated env
  start.ts                  HTTP + worker + token refresher, graceful shutdown
  webhooks/routes.ts        GET verify · POST receive (raw body → HMAC → parse → persist)
  webhooks/signature.ts     X-Hub-Signature-256, timing-safe
  meta/events.ts            Zod schemas for webhook payloads (from Phase 1 fixtures)
  meta/graph-client.ts      Send API: text, generic template, sender actions; typed errors,
                            retry on 5xx/429, 1000-byte text guard
  meta/token-store.ts       long-lived token in DB, refresh when < 20 days left
  backend/stashh-client.ts  typed client for /internal/v1 (service token)
  conversation/interpret.ts event → SharedMedia | Link | Text | Unsupported | Ignore (echo, own id)
  conversation/worker.ts    claim → identity → recognition → poll → reply
  conversation/repository.ts
  replies/compose.ts        places → [intro text, carousel(≤10 per message)]
  replies/copy.tr.ts        all user-facing strings
```
- [ ] Migration (owned by the channel, own table prefix): `instagram_messages` (mid unique,
      sender_igsid, kind, payload jsonb, status, recognition_id, attempts, next_attempt_at,
      error, timestamps) + claim RPC; `instagram_accounts` (ig_user_id, token, expires_at)
- [ ] Ignore echoes, `sender.id == entry.id`, deletes, reactions, seen; `typing_on` while working
- [ ] Reply rendering: intro text ("3 mekan buldum 📍") + generic-template carousel per place:
      image `thumbnail_url`; title = name; subtitle = `★ rating · district` + top
      recommendation (80-char limit, grapheme-safe truncation); buttons "Haritada aç"
      (Google Maps URL with `query_place_id`) and "Instagram" when `instagram_username` exists.
      Empty result, unsupported share, plain text and failure each get a dedicated message
- [ ] Respect the 24h window: drop replies whose source message is older than 24h
- [ ] Tests: signature, payload parsing (fixtures), interpretation, composer limits
      (titles, bytes, 10-element split), worker state machine with a fake backend + fake Graph

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
