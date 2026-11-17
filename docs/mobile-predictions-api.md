# Mobile agent instructions: image classification results

Implement a read-only Results screen using the deployed FusaShield API. Do not connect the mobile app directly to Firebase, upload images again, or construct Supabase Storage URLs.

## Endpoints

Use the API base URL configured for the FusaShield deployment:

- `GET {baseUrl}/api/predictions/latest`
- `GET {baseUrl}/api/predictions/history?limit=30`

Both endpoints are read-only and currently require no API key or Authorization header. The API server reads Firebase credentials/configuration; never put Firebase auth tokens or Supabase keys in the mobile app.

### Latest response

```json
{
  "latest": {
    "history_id": "-FirebaseGeneratedId",
    "image_path": "cabai_01/name.jpg",
    "processed_at": "2026-11-17T14:00:00+00:00",
    "status": "ok",
    "prediction": "ulat",
    "confidence": "yakin",
    "margin": 1.388,
    "mask_ratio": 0.59,
    "scores": {},
    "processed_images": {
      "preprocess": "https://...",
      "segmentation": "https://...",
      "reconstruction": "https://..."
    },
    "recommendation": {}
  }
}
```

`latest` can be `null` before any classification has completed.

### History response

```json
{
  "count": 1,
  "items": [
    {
      "history_id": "-FirebaseGeneratedId",
      "image_path": "cabai_01/name.jpg",
      "processed_at": "2026-11-17T14:00:00+00:00",
      "prediction": "ulat",
      "confidence": "yakin",
      "margin": 1.388,
      "mask_ratio": 0.59,
      "processed_images": {},
      "recommendation": {}
    }
  ]
}
```

`limit` is optional and is clamped to 1–100. The API orders the returned items by `processed_at`, newest first. Show an error state for non-2xx responses; do not silently substitute an empty successful result.

## Results screen

1. Show `latest` as the newest classification.
2. Show `items` as history, newest first. Each row/card should include `processed_at`, `image_path`, `prediction`, `confidence`, `margin`, `mask_ratio`, and its recommendation.
3. Render the processing images using the returned URLs exactly:
   - `processed_images.preprocess` — **Praproses**
   - `processed_images.segmentation` — **Segmentasi**
   - `processed_images.reconstruction` — **Rekonstruksi**
4. If `processed_images` is null, missing, or has no image URLs, show **“Gambar hasil proses belum tersedia.”**
5. Render recommendation fields when present: `nama`, `tingkat_perhatian`, `kemungkinan_penyebab`, `tindakan_segera`, `budidaya`, `hayati`, `kimia`, and `pemantauan`.
6. Handle null/missing individual fields without crashing.

The REST endpoints return a snapshot when requested. Re-fetch latest and history while the Results screen is active, or after a successful photo upload, if the screen needs to reflect new classifications. The web app separately uses Firebase realtime listeners.
