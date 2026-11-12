# Product analytics — Mixpanel

What people do in the interfaces they see and touch, measured in Mixpanel. The
conventions follow the My Dora website's setup (typed catalog, snake_case past
tense, EU residency, one copy of each event, Lexicon kept current).

**The code is the source of truth.** Each interface has one catalog:
[`web/lib/analytics/events.ts`](../web/lib/analytics/events.ts) for the web and
[`instagram/src/analytics/events.ts`](../instagram/src/analytics/events.ts) for the DM
conversation. Where this file disagrees with them, this file is wrong.

## Scope

- **Measured:** the interfaces people use.
  - stashh.me (landing) and the map app at `/app`.
  - The Instagram DM conversation, where people share posts to analyse (owner's call,
    2026-11-12: the analyses matter, and the conversation is an interface people use). The
    DM service sends what the person lives there: sign-up, a share taken in, its answer.
  - iOS is paused; when it resumes it sends the web's catalog, the same names and the same
    user id.
- **Not measured here:** the backend, the recognition worker, the hooks relay and `ops/`
  carry no Mixpanel code. How the system did its work (recognition runs and their steps,
  DM intents, assistant turns, cost) stays in the ops SQL functions behind the dashboard.

## Projects

| Project | Token in | `app_env` |
|---|---|---|
| Stashh - Production (EU) | Vercel production env; `MIXPANEL_TOKEN` in the production host's `instagram.env` | `production` |
| Stashh - Staging (EU) | `web/.env.local`, Vercel preview env; `MIXPANEL_TOKEN` in `instagram/.env` on the dev Mac | `development` |

Both live in the **Little Big Apps** Mixpanel organisation. Without
`NEXT_PUBLIC_MIXPANEL_TOKEN` (web) or `MIXPANEL_TOKEN` (DM service) every call is a no-op.
The dev DM instance shares the database with production, so the same person has the same
user id in both projects.

## How it is wired

- [`web/lib/analytics/analytics.ts`](../web/lib/analytics/analytics.ts) is the only
  module that touches the SDK: `startAnalytics`, `track`, `identify`, `setProfile`,
  `reset`.
  - It loads `mixpanel-browser`'s **core build** (no session recorder) with a dynamic
    import on first use. That is a 36 KB gzip lazy chunk, absent from the landing
    page's first load.
  - Calls made before the SDK loads run in order once it has.
- **SDK settings:**
  - `api-eu.mixpanel.com`, `localStorage` persistence, so there is no cookie.
  - Page views come from the SDK (`track_pageview: "url-with-path"`).
  - UTMs attach only to the landing load's events. First or last touch is chosen in the
    report.
  - Autocapture, heatmaps and session replay are off, as a code constant, not an env
    value.
  - Batched with retry in production; sent at once in development.
- **Same-tab navigation:** a click that leaves the page (directions, the source post,
  the Instagram button) passes `{ leavesPage: true }`. Links open in place because popups
  break in in-app browsers. The event then goes out by `sendBeacon` instead of waiting in
  a batch the navigation would cut off.
- **Writes are tracked when the server confirms them**, in the mutation's `onSuccess` in
  [`web/lib/stashh/mutations.ts`](../web/lib/stashh/mutations.ts). That gives one place
  per action, whichever screen started it, and a failed request sends nothing.

## The Instagram DM conversation

- [`instagram/src/analytics/mixpanel.ts`](../instagram/src/analytics/mixpanel.ts) is the
  only module that talks to Mixpanel from the DM service: plain `fetch` to the Ingestion
  API (`/track`, `/engage` on `api-eu.mixpanel.com`, `verbose=1`), 5 s timeout. It never
  throws and never holds up a reply; a failed send is logged with the event name and HTTP
  status only. Sends in flight are awaited on shutdown.
- **Fired from `MessageProcessor`** (`instagram/src/conversation/processor.ts`), the DM's
  equivalent of `onSuccess`: an outcome goes out once the answer was delivered and the
  message settled for good. A settled message is never processed again, so it reports its
  outcome exactly once.
- **`recognition_started` may be sent again** when a step is retried. It carries the
  share's own time and an `$insert_id` derived from the message id, so Mixpanel keeps one
  (it dedupes on event, `distinct_id`, `time` and `$insert_id`).
- **Every share that started ends** in `recognition_completed` or `recognition_failed`,
  including the daily limit, a timeout, a closed reply window and a permanent failure on
  our side (`error`). The one gap: a share whose last retry fails before the user is known
  again reports no end. Rare.
- **Not sent:** an attachment Stashh cannot read (`unsupported`), chat, help, the map link
  request and `/env`. The ops SQL counts those intents.
- **No device, browser, location or UTM** on DM events: the conversation brings none of
  them, and none is made up. Mixpanel would place everyone at the server's IP, so events
  and profile updates go out with the IP lookup off (`ip=0`, `$ip: "0"`). Break DM events
  down by location through the profile, which the web fills in when the person opens their
  map.
- **`app_env`** on every event, from the instance (`production` on the production host,
  `development` elsewhere). There is no `channel` property: every DM event comes from the
  DM.
## Identity

- The **Supabase user id is the Mixpanel user id**, on every surface. The id is the same
  one the DM channel creates, so the web and iOS meet in one profile.
- `identify(userId)` runs once a session exists (`AnalyticsSession` in
  `app/(app)/_components/`), never with an anonymous id. Simplified ID Merge joins the
  device's earlier anonymous events, such as the landing visit before a DM map link.
- `reset()` runs on an explicit sign-out, and inside `identify` when the device still
  carries another user's id. That happens when a second Instagram account opens its DM
  link in the same in-app browser, so two people are never merged. A visitor who was
  never signed in keeps one device id.
- The DM link page names the link's user before it sends `map_link_opened`. The session
  mirror identifies only after the next render, so without this the event would go to
  the account that was signed in before.
- **On every event**, added by a `before_track` hook. It is not `register`: the SDK
  sends the first page view inside `init`, and `reset` wipes registered properties.
  - `app_env`, a guard against a wrong token.
  - `in_app_browser` (`instagram` | `facebook` | `tiktok`, absent in a normal browser).
    Most visits come from Instagram's in-app browser.
- **Profile** (the only place personal data goes), from `/me` once per session:
  `$name`, `instagram_username`, `$created`.
- **The DM side** sends `distinct_id` and `$user_id` set to the same Supabase user id, so
  a share and the later map visit land on one profile. A new DM user's profile is started
  at sign-up: `$created` (set once) and, when Instagram gave them, `$name` and
  `instagram_username`. Erasing data ("sil") deletes the profile too; past events keep
  only the bare user id. A deletion asked for by e-mail goes through the backend's erase
  route, which does not reach Mixpanel: delete the profile by hand in both projects
  (Users → the profile → Delete), as the privacy policy promises.

## Naming rules

- `snake_case`, `object_action`, past tense: what happened, never a component or a
  screen.
- Booleans start with `is_` or `has_`. Durations carry their unit (`duration_ms`).
- A property with only one possible value is not a property.
- No personal data in properties: no usernames, note text or source URLs.
- A name is coined in exactly one catalog, the one of the interface where the person
  acts (web or DM). Title Case lives in Lexicon as the display name. It is never the name
  in code.
- Retire an event by hiding it in Lexicon in both projects; never delete it.

## Catalog

| Event | Fired from | Properties |
|---|---|---|
| `$mp_web_page_view` | SDK, on load and path change | — |
| `instagram_cta_clicked` | landing button, signed-out screen | `surface`: landing, signed_out, invalid_link |
| `map_link_opened` | `/app/a/[code]`, sign-in succeeded; also to Meta as `MapLinkOpened` | — |
| `map_link_failed` | `/app/a/[code]`, link invalid | — |
| `list_created` | new list | `entry`: place, empty |
| `list_viewed` | list opened from home or library | `entry`, `place_count` |
| `place_added_to_list` | saved place filed into a list | — |
| `place_viewed` | place card opened | `entry`: map_pin, home, list, library, search |
| `place_visited` | "been there" toggled | `is_visited` |
| `place_note_saved` | note committed | `has_note` |
| `place_removed` | place removed from the library | — |
| `directions_opened` | directions button | — |
| `source_post_opened` | open the post, from a place | `surface` |
| `location_permission_answered` | location asked for from profile or home | `is_granted`, `surface` |
| `user_signed_out` | sign-out confirmed | — |

**From the DM conversation** (`instagram/src/analytics/events.ts`):

| Event | Fired when | Properties |
|---|---|---|
| `user_signed_up` | the person's first message created their account | — |
| `recognition_started` | a share or a pasted link is taken in | `entry`: dm_share, dm_link; `source_type`: reel, post, story, tiktok |
| `recognition_completed` | the places reached the person (already on their map) | `place_count`, `duration_ms`, `entry`, `source_type` |
| `recognition_failed` | the person got an answer without places | `reason`: private, unavailable, unreadable, no_places, needs_link, timed_out, daily_limit, error; `duration_ms`, `entry`, `source_type` |

`duration_ms` is the person's wait: from their message to the answer.

**Back in use (2026-11-12):** `recognition_started`, `recognition_completed` and
`recognition_failed` were the web's paste flow until 2026-11-10 (`entry`: clipboard,
paste, retry) and now come from the DM (`entry`: dm_share, dm_link). Same meaning, except
that a DM `recognition_completed` also means the places were saved: the DM saves them
without a step of its own.

**Retired (2026-11-10):** `places_saved`, `clipboard_watch_toggled`. Hide these two in
Lexicon in both projects.

## Funnels

- **Activation:** `user_signed_up` → `recognition_completed` → `map_link_opened` →
  `place_viewed`.
- **Analysis:** `recognition_started` → `recognition_completed`, broken down by
  `source_type`; `recognition_failed` by `reason`.
- **Arrival:** `map_link_opened` → `place_viewed`.
- **Going:** `place_viewed` → `directions_opened`.
- **Landing:** `$mp_web_page_view` (path `/`) → `instagram_cta_clicked`.

## Meta: Pixel and Conversions API

Meta is a second destination for the few events ad audiences are built from, not a
second analytics tool. Today that is one event: `map_link_opened`, sent as
`MapLinkOpened`, the seed of the lookalike audience for DM campaigns.

- **Which events:** only those in `metaEvents` in `events.ts`. Nothing else reaches
  Meta: no page views (on load or on route changes), no autocapture
  (`autoConfig` off, `disablePushState` on).
- **Sent twice, counted once.** The browser sends it through the pixel
  ([`meta-pixel.ts`](../web/lib/analytics/meta-pixel.ts), called only by `track` when it
  is given `{ meta: { eventId, userId } }`). The Next server sends the same event to the
  Conversions API ([`meta-capi.ts`](../web/lib/analytics/meta-capi.ts)) from the `redeem`
  server action, in `after()`, with the same `event_id`. Meta drops the duplicate.
- **Why the Next server, not the backend:** it is the only place that sees the visitor's
  own IP and user agent, which is what Meta matches on. The backend still sends nothing.
- **What Meta receives:** the event and its time, IP, user agent, the pixel's own
  `_fbp`/`_fbc` cookies, and the SHA-256 of the Supabase user id (`external_id`).
  Never the Instagram id, a username or the link's code (`event_source_url` is `/app/a`).
- **The server's copy is sent when the code is valid**, the browser's after the sign-in.
  If `verifyOtp` fails in between, Meta has a server event and Mixpanel has
  `map_link_failed`. Rare, and harmless for an audience.
- **Env:** `NEXT_PUBLIC_META_PIXEL_ID` (empty: nothing is sent from either side),
  `META_CAPI_ACCESS_TOKEN` (server only), `META_TEST_EVENT_CODE` (local and preview only;
  events land under Test Events and build no audience). Set in Vercel production only.
- **No consent banner**, the owner's call (2026-11-10); the privacy policy names the
  sharing and its legal basis. Adding an event to `metaEvents` means updating the policy
  in the same change.
- **Graph API version** is a constant in `meta-capi.ts`; raise it when Meta retires it.

## Adding an event

1. Add it to the catalog of the interface where the person acts (`EventCatalog` in the
   web's `events.ts`, `DmEventCatalog` in the DM service's), following the rules above.
2. Fire it where the person acts. For a web write, fire it in the mutation's `onSuccess`;
   in the DM, once the message has settled.
3. Add it to the catalog table here.
4. Once it arrives, give it a Lexicon display name, a description and `verified` in both
   projects.
