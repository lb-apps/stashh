# discovery

## Places API (saved locations)

- **Canonical endpoints:** `GET/POST /api/v1/places`, `GET/PATCH/DELETE /api/v1/places/:placeId`, `GET /api/v1/places/photos/:placeId`.
- All path parameters named `placeId` refer to the canonical place identifier (`id` in response objects).

**Requirements:** `POST /api/v1/places` and canonical place upserts need `SUPABASE_SECRET_KEY` on the server (service-role writes). Ownership checks (`/api/v1/lists` → add place to list) use the user JWT only.

### `POST /api/v1/places` body

- **`source`: `"google"`** — only Google Place IDs are known. Body: `{ "source": "google", "place_ids": ["ChIJ…", …] }`. For each ID, if the place does not exist yet, the server loads full data from **Places API (New)** and creates it.

- **`source`: `"recognition"`** — selections come from a saved recognition result. Body: `{ "source": "recognition", "recognition_result_id": "<uuid>", "place_ids": ["ChIJ…", …] }`. Every ID must appear in that result's items. If the place does not exist yet, the server builds it from the recognition item, then **backfills empty columns** from Places API (New). If the API call fails, the place is still created from recognition data only.

- **`place_ids`**: Google Place IDs (strings), 1–50 unique entries after deduplication.

If a place **already exists** for a Google Place ID, the server links it to the user's saved places only (no duplicate Places API call for that ID).
