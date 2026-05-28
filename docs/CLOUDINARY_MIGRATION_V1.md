# Cloudinary Image Storage Migration V1

## What changed

CivicSense now supports two image storage modes:

- `STORAGE_PROVIDER=local` keeps the existing local upload behavior.
- `STORAGE_PROVIDER=cloudinary` uploads new issue report and resolution evidence images to Cloudinary.

The backend stores image references in the existing string fields, so V1 does not require a database migration. New Cloudinary uploads store Cloudinary `secure_url` values. Existing local database values such as filenames or `/uploads/...` paths still work through `MediaUrlService`.

## Environment variables

```env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=civicsense
```

Local development can keep:

```env
STORAGE_PROVIDER=local
```

Cloudinary credentials are required only when `STORAGE_PROVIDER=cloudinary`. In the `prod` profile, startup validation fails fast if Cloudinary mode is selected without `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET`.

Do not commit real Cloudinary credentials.

## Local mode

Local mode writes uploaded files under `FILE_UPLOAD_DIR` and returns public upload URLs using `PUBLIC_BASE_URL/uploads/...`.

`UPLOADS_PUBLIC=true` keeps `/uploads/**` publicly readable. This is still useful for local development and for older local image records.

## Cloudinary mode

Cloudinary mode writes the multipart image to a local temp file first, then uploads that file to Cloudinary under:

```txt
CLOUDINARY_FOLDER/<folder-hint>
```

Current folder hints:

- `issue-reports`
- `resolution-evidence`

The database stores the Cloudinary `secure_url` for display and the Cloudinary `public_id` is used as the storage key for upload events.

## Old local images

Old local images continue to display because `MediaUrlService` still handles:

- full `http://` and `https://` URLs
- `/uploads/filename`
- `uploads/filename`
- raw local filenames

Cloudinary `secure_url` values pass through unchanged.

## AI processing temp files

The current Kafka/AI pipeline still calls `AiServiceClient.analyzeImageFromPath(...)`, so Cloudinary mode keeps a local temp copy under `FILE_UPLOAD_DIR/cloudinary-temp`.

Do not delete the local temp upload folder until the AI pipeline accepts remote URLs or another durable image handoff is implemented.

## How to test

1. Local mode: run with `STORAGE_PROVIDER=local`, upload an issue image, and confirm the issue image URL displays from `/uploads/...`.
2. Cloudinary mode: run with `STORAGE_PROVIDER=cloudinary` and valid Cloudinary credentials, upload an issue image, and confirm the DB value and API response contain a Cloudinary `https://...` URL.
3. Resolution evidence: submit worker resolution evidence and confirm `resolutionImageUrl` is a local public URL in local mode or Cloudinary `secure_url` in Cloudinary mode.
4. AI processing: confirm the image upload event still includes a local file path and the AI consumer can analyze the image from that path.
5. Backward compatibility: seed or keep an old filename-only media value and confirm it still resolves through `PUBLIC_BASE_URL/uploads/...`.

## Warnings

- Do not commit Cloudinary credentials.
- Do not delete local upload or `cloudinary-temp` folders while AI processing still needs local file paths.
- This migration does not need a Flyway migration in V1 because image fields already store strings.
