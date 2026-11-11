# 0004: Garage as the local S3 storage

Date: 2026-11-11 · Status: accepted

## Context

Prod stores files in Cloudflare R2. Local dev needs an S3-compatible server in Docker so the same app code (AWS S3 SDK, presigned URLs) runs against both, with only the endpoint and keys changing. MinIO, the usual choice, no longer ships maintained free Docker images.

## Decision

Use **Garage** (`dxflrs/garage`, pinned to v2.5.0) in `docker/compose.dev.yml`, as a single node:

- `garage server --single-node --default-bucket` creates the access key and bucket on first start from `GARAGE_DEFAULT_ACCESS_KEY`, `GARAGE_DEFAULT_SECRET_KEY` and `GARAGE_DEFAULT_BUCKET`.
- Secrets (RPC secret, keys) come from `docker/.env`; `docker/garage/garage.toml` holds none and is committed.
- The S3 API is on `127.0.0.1:3900`, region `garage`. Prod (R2) uses region `auto`.
- Bucket CORS has no Garage CLI command; it is set through the S3 API (`PutBucketCors`) when browser uploads arrive in phase 2.

## Why / alternatives rejected

- **Close to R2:** like R2, Garage has no ACLs, bucket policies or versioning, so code that relies on them fails locally instead of first in prod. Presigned URLs, multipart uploads and bucket CORS are all supported.
- **Light:** one small Rust binary, which suits the small-VM mindset.
- **SeaweedFS:** also supports everything we need and has a simpler config (one JSON file), but it is a much larger system and supports S3 features R2 lacks.
- **MinIO:** free Docker images are no longer maintained.
