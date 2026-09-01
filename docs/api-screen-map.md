# API ↔ Screen Map

Which backend endpoints power each screen / user-flow, and the Swift `APIEndpoint` builder to call.

**Source of truth (always check the live spec, this doc can drift):**
- Running Scalar UI: `/docs` · raw spec: `/openapi.json` (run backend: `cd backend && PORT=3001 npx tsx src/index.ts`)
- Per-domain definitions: `backend/src/modules/<domain>/openapi.ts` + `routes.ts`
- Swift builders: [APIEndpoint.swift](../ios/Stashh/Core/Networking/APIEndpoint.swift) — call these via a `…Repository`, never `APIClient` directly.

All routes live under `/api/v1/`. Every response uses the envelope `{ ok, data, meta, error }`; auth is a Supabase JWT Bearer token.

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
| Google photo URLs | `APIEndpoint.placePhotos(id:limit:maxWidth:)` | `GET /places/photos/:placeId` |

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
| Update list (title/emoji) | `APIEndpoint.updateList(id:body:)` | `PATCH /lists/:id` |
| Delete list | `APIEndpoint.deleteList(id:)` | `DELETE /lists/:id` |
| Places in a list (paginated) | `APIEndpoint.listPlaces(listId:limit:cursor:)` | `GET /lists/:id/places` |
| Add place to list | `APIEndpoint.addListPlace(listId:placeId:)` | `POST /lists/:id/places` |
| Remove place from list | `APIEndpoint.removeListPlace(listId:listPlaceId:)` | `DELETE /lists/:listId/places/:listPlaceId` |

## Recognition flow (Instagram or TikTok link → places)

The core feature. Async: enqueue → poll → review → commit.

Accepted sources: Instagram Reel/Post/Story URLs and TikTok video URLs. The worker
routes by platform in `source-content.ts`; `source_type` comes back as `reel`,
`post`, `story`, or `tiktok`. `instagram_username` is only populated for Instagram
sources, since an @handle on TikTok is a TikTok handle.

| Step | Swift builder | Route |
|---|---|---|
| 1. Enqueue from a source URL | `APIEndpoint.createRecognition(sourceURL:)` | `POST /recognitions` |
| 2. Poll task status | `APIEndpoint.recognitionStatus(id:)` | `GET /recognitions/:id` |
| 3. Fetch result by result id | `APIEndpoint.recognitionResult(resultId:)` | `GET /recognitions/result?id=` |
| 4. Commit extracted places to library | `APIEndpoint.commitRecognition(id:)` | `POST /recognitions/:id/commit` |

Task status lifecycle: `queued → processing → completed → committed` (also `failed/expired/cancelled`).

## Profile

No dedicated endpoints yet — identity comes from Supabase auth (`AuthManager`). `ProfileView` is a stub.
