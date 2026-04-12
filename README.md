# discovery

## Places API (saved locations)

- **Canonical endpoints:** `GET/POST /api/v1/places`, `GET/PATCH/DELETE /api/v1/places/:userPlaceId`, `GET /api/v1/places/photos/:placeId` (canonical place id for on-demand gallery URLs).
- **`user_place_id`** path parameter refers to a row in `user_places` (the user’s saved copy), not the canonical `places.id` (except on the `/photos/:placeId` route).

**Requirements:** `POST /api/v1/places` and canonical `places` upserts need `SUPABASE_SECRET_KEY` on the server (service-role writes). Ownership checks (`/api/v1/lists` → add place to list) use the user JWT only.

### `POST /api/v1/places` body

- **`source`: `"google"`** — only Google Place IDs are known. Body: `{ "source": "google", "place_ids": ["ChIJ…", …] }`. For each ID, if there is no canonical `places` row yet, the server loads full data from **Places API (New)** and upserts.

- **`source`: `"recognition"`** — selections come from a saved recognition result. Body: `{ "source": "recognition", "recognition_result_id": "<uuid>", "place_ids": ["ChIJ…", …] }`. Every ID must appear in that result’s items. If there is no canonical row yet, the server builds a row from the recognition item, then **backfills empty columns** from Places API (New). If the API call fails, the row is still created from recognition data only.

- **`place_ids`**: Google Place IDs (strings), 1–50 unique entries after deduplication.

If a canonical row **already exists** for a Google Place ID, the server links `user_places` only (no duplicate Places API call for that ID).