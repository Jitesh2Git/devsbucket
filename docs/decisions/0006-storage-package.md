# 0006: A shared `packages/storage`

Date: 2026-11-12 · Status: accepted

## Context

LOCKED.md fixes the monorepo packages as `db`, `authz` and `shared`. Phase 2 talks to object storage (Garage locally, R2 in prod) from two places: the web app (presigned uploads and downloads) and the worker (cleaning up abandoned uploads, emptying trash, retrying failed deletes).

## Decision

Add **`packages/storage`** (`@devsbucket/storage`): one S3 client configured from env (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`), the presign/head/delete/multipart helpers, the usage counting for R2's operation limits, and a `storage:setup` script that sets the bucket's CORS. Like `shared` and `db`, it exports TypeScript source (no build step).

## Why / alternatives rejected

- **Inside `apps/web`:** the worker would have to copy it or import from an app, and apps shouldn't depend on each other.
- **Inside `packages/db`:** mixes two unrelated concerns (SQL and object storage) and would give every database user the AWS SDK.
- **Keys:** objects are stored as `items/<item id>`, never by file name, so renames and moves never touch storage.
