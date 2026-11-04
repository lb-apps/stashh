# API ↔ Screen Map

Which backend endpoints power each screen / user-flow, and the Swift `APIEndpoint` builder to call. A `—` builder means the route has no Swift builder yet (the web app uses it first).

**Source of truth (always check the live spec, this doc can drift):**
- Running Scalar UI: `/docs` · raw spec: `/openapi.json` (run backend: `cd backend && PORT=3001 npx tsx src/index.ts`)
- Per-domain definitions: `backend/src/modules/<domain>/openapi.ts` + `routes.ts`
- Swift builders: [APIEndpoint.swift](../ios/Stashh/Core/Networking/APIEndpoint.swift) — call these via a `…Repository`, never `APIClient` directly.

All routes live under `/api/v1/`. Every response uses the envelope `{ ok, data, meta, error }`; auth is a Supabase JWT Bearer token. The web app calls the API straight from the browser; its origins are allowed by `WEB_ORIGINS` (CORS), every other origin is blocked.

### The saved place

`GET /places`, `GET /places/:id`, `GET /places/nearby`, `PUT|DELETE /places/:id/visit` and `GET /lists/:id/places` (as `place`) all return the same `SavedPlace`. Beyond the place's Google fields and your `notes` / `saved_at`, it carries:

- `category_group` — `coffee · food · bar · rooftop · sweets · bakery · wine · park · view · market · default`, derived from Google's types in one place (`places/mapper.ts`). Pin colour, icon and filter chip come from it, never from `category`.
- `utc_offset_minutes` — with `opening_hours` (local-time periods), enough to compute "open now".
- `list_ids` — your lists that hold the place.
- `visited_at` — when you marked it "Been there"; null otherwise.
- `source` — `{ url, type, thumbnail_url, author_username }` of the post it was found in; null when saved from search. `url` is null for a post shared in a DM.

With these the web app loads the library once (`GET /places?limit=100`, following `next_cursor`) and derives search, filters, scopes (Open now / To go / Been) and per-list maps on the client.

## Explore (map)

| Need | Swift builder | Route |
|---|---|---|
| Places near the user, by distance | `APIEndpoint.nearbyPlaces(latitude:longitude:radiusM:limit:cursor:category:)` | `GET /places/nearby` |

Uses `LocationManager` for device coordinates. Already wired in [ExploreViewModel.swift](../ios/Stashh/Features/Explore/ExploreViewModel.swift) (debounced on map-region change). Markers render via `ExplorePlacePinView`.

## Library (dashboard)

| Need | Swift builder | Route |
|---|---|---|
| Aggregated summary (district + category counts, list summaries) | `APIEndpoint.library()` | `GET /library` |
| Recent saved places | `APIEndpoint.places(limit:cursor:sort:district:category:)` | `GET /places` |

`GET /library` aggregation runs in Postgres via RPCs (`get_library_district_counts()`, `get_library_category_counts()`). `LibraryView` is currently a stub.

## Place detail

| Need | Swift builder | Route |
|---|---|---|
| Single saved place | `APIEndpoint.place(id:)` | `GET /places/:id` |
| Google photo URLs (saved places only; `Cache-Control: private, max-age=86400`) | `APIEndpoint.placePhotos(id:limit:maxWidth:)` | `GET /places/photos/:placeId` |
| "Been there" on / off | — | `PUT` / `DELETE /places/:id/visit` |

## Save / edit / remove a place

| Need | Swift builder | Route |
|---|---|---|
| Add one or more places | `APIEndpoint.addPlaces(body:)` | `POST /places` |
| Update notes | `APIEndpoint.updatePlace(id:body:)` | `PATCH /places/:id` |
| Remove a saved place | `APIEndpoint.deletePlace(id:)` | `DELETE /places/:id` |

If a place already exists for a Google Place ID, the server only links it to the user (no duplicate Places API call).

## Lists

| Need | Swift builder | Route |
|---|---|---|
| All lists | `APIEndpoint.lists()` | `GET /lists` |
| One list | `APIEndpoint.list(id:)` | `GET /lists/:id` |
| Create list | `APIEndpoint.createList(body:)` | `POST /lists` |
| Update list (title/emoji/cover) | `APIEndpoint.updateList(id:body:)` | `PATCH /lists/:id` |
| Delete list | `APIEndpoint.deleteList(id:)` | `DELETE /lists/:id` |
| Places in a list (paginated, each a full `SavedPlace`) | `APIEndpoint.listPlaces(listId:limit:cursor:)` | `GET /lists/:id/places` |
| Add place to list | `APIEndpoint.addListPlace(listId:placeId:)` | `POST /lists/:id/places` |
| Remove place from list | `APIEndpoint.removeListPlace(listId:listPlaceId:)` | `DELETE /lists/:listId/places/:listPlaceId` |

A list's `cover_category` (one of the `category_group` values, or null) picks its cover art; set it on `POST` / `PATCH /lists`.

## Recognition flow (Instagram or TikTok link → places)

The core feature. Async: enqueue → poll → review → save the chosen places.

Accepted sources: Instagram Reel/Post/Story URLs and TikTok video URLs. The worker
routes by platform in `source-content.ts`; `source_type` comes back as `reel`,
`post`, `story`, or `tiktok`. `instagram_username` is only populated for Instagram
sources, since an @handle on TikTok is a TikTok handle.

| Step | Swift builder | Route |
|---|---|---|
| 1. Enqueue from a source URL | `APIEndpoint.createRecognition(sourceURL:)` | `POST /recognitions` |
| 2. Poll task status (with live `stage`) | `APIEndpoint.recognitionStatus(id:)` | `GET /recognitions/:id` |
| 3. Fetch result by result id | `APIEndpoint.recognitionResult(resultId:)` | `GET /recognitions/result?id=` |
| 4. Save the chosen places | `APIEndpoint.addPlaces(body:)` | `POST /places` with `source: "recognition"` |
| 5. Mark the result handled (optional) | `APIEndpoint.commitRecognition(id:)` | `POST /recognitions/:id/commit` |
| Latest recognitions ("From your reels", "Last pulled in") | — | `GET /recognitions?limit=` |

**Committing saves nothing.** Places reach the library only through `POST /places` (step 4), which also records the recognition as each place's `source`. Recognitions sent over Instagram DM skip steps 3–5: the worker saves everything they find to the sender's library before the task completes (`options.auto_save`).

Task status lifecycle: `queued → processing → completed → committed` (also `failed/expired/cancelled`). While `processing`, `stage` moves `fetching → analyzing → matching → saving`; the web app's four progress steps map onto it.

## Profile

| Need | Swift builder | Route |
|---|---|---|
| Name, Instagram username, joined date, saved count | — | `GET /me` |

## Web sign-in (DM link)

Everyone who writes to @stashh.me on Instagram is a Supabase user already (`channel_identities`). The web app signs them in with a personal link the DM service sends: `<WEB_APP_URL>/a/<code>` (default `https://stashh.me/app/a/<code>`). It never expires and opens the map every time, until the person is erased.

| Step | Caller | Route |
|---|---|---|
| Mint a link for a user | DM service (service token) | `POST /internal/v1/users/:userId/sign-in-links` |
| Redeem the code, get a magic-link `token_hash` | web app's server (service token) | `POST /internal/v1/sign-in-links/redeem` |
| Turn the token into a session | browser | `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })` |

The DM reply to every recognition carries a "Haritanda aç" button with a fresh link; writing "harita" or "link" gets one on demand.
