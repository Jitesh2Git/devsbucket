# Phase 2 plan: Drive basics

Planned 2026-11-12, at the end of Phase 1 (`v0.1.0`). Checklist and progress: `docs/PROGRESS.md`. Decisions made for this phase: `docs/decisions/0006-storage-package.md`, `docs/decisions/0007-names-and-trash.md`.

## Goal

A signed-in user can create folders, upload files up to 100 MB straight to storage (Garage locally, R2 in prod), browse with pagination, preview, download, rename, move, trash, restore and delete forever. Their quota and the app-wide storage limits are enforced. CI covers it.

**Done when:** all of the above works in the browser with `pnpm docker:up` + `pnpm dev`, the e2e test covers folder → upload → rename → move → trash → restore → delete forever, and CI is green.

## Scope

- **In:** one owner per item. Only the owner can see or change their items.
- **Out (Phase 3):** sharing, roles and grants, share links, the activity log, notifications, realtime updates. **Out (Phase 4/5):** live editing, versions, notes, search, starred/recent, ZIP download.
- **Still done right now:** every server action and route handler checks permissions through `packages/authz` (CLAUDE.md rule), so Phase 3 extends `can()` instead of touching every action.

## How each step is run

Same as Phase 1 (learning mode): one branch and one PR per step, researched and tested in a scratch copy first, then explained for the user to build, then verified. Versions are checked with `npm view` at the time of the step (pnpm's release-age guard skips anything less than a day old).

## Design

### Data model: one `items` table

Folders and files (and Phase 5 notes) live in one table that points to its parent, like a file system.

| Column                     | Type                                  | Notes                                                                                |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                       | uuid, `uuidv7()`                      |                                                                                      |
| `owner_id`                 | uuid → `users.id`, cascade            | The tree's owner; quota is charged to them (decision 0002)                           |
| `parent_id`                | uuid → `items.id`, cascade, nullable  | `null` = top level of My Drive (no root row)                                         |
| `created_by`               | uuid → `users.id`, set null           | Who created or uploaded it                                                           |
| `type`                     | text, check: `folder`, `file`, `note` | Text + check constraint, not a Postgres enum (easier to extend)                      |
| `name`                     | text                                  | 1–255 characters; no `/`, no control characters, not `.` or `..`; trimmed            |
| `mime_type`                | text, nullable                        | Files only. Sniffed from the extension, never trusted for inline display             |
| `size`                     | bigint (number), nullable             | Bytes, files only                                                                    |
| `storage_key`              | text, unique, nullable                | Files only: `items/<item id>`. No file names in keys, so renames never touch storage |
| `status`                   | text, check: `pending`, `ready`       | `pending` while uploading; folders are always `ready`                                |
| `upload_id`                | text, nullable                        | S3 multipart upload id while a large upload is pending                               |
| `created_at`, `updated_at` | timestamptz                           |                                                                                      |
| `trashed_at`               | timestamptz, nullable                 | Set on the trashed item **and** everything inside it                                 |
| `trashed_by`               | uuid → `users.id`, set null           |                                                                                      |
| `trash_root`               | boolean, default false                | `true` only on the item the user trashed (what the Trash view lists)                 |

Indexes:

- **Unique name per folder** (decision 0007): unique index on `(owner_id, coalesce(parent_id, owner_id), lower(name)) where trashed_at is null`. The `coalesce` makes "top level" behave like one folder (Postgres treats NULLs as different otherwise; Drizzle only offers `nulls not distinct` on plain constraints, not partial indexes). Pending uploads count, so their name is reserved. Verify the generated SQL in step 1.
- Listing: `(parent_id, type, lower(name), id)` and `(owner_id, type, lower(name), id) where parent_id is null`.
- Trash view: `(owner_id, trashed_at) where trash_root`.
- Worker: `(status, created_at) where status = 'pending'`.

Users keep `storage_used` / `storage_quota` (step 9 of Phase 1). App-wide counters get a new table:

| `usage_counters` |                                                                   |
| ---------------- | ----------------------------------------------------------------- |
| `month`          | text `YYYY-MM`, primary key                                       |
| `class_a_ops`    | bigint: writes and lists (PUT, multipart, list) issued this month |
| `class_b_ops`    | bigint: reads (GET, HEAD) issued this month                       |

Total stored bytes is not a counter: it's `sum(users.storage_used)`, which already includes reservations.

### Names that already exist (decision 0007)

Names are unique in a folder, ignoring upper/lower case. The user always sees what happened:

| Where                    | What happens                                                                 | What the user sees                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| New folder, rename, move | Refused                                                                      | Inline error on the field: "A file or folder named "x" already exists here." They change the name.                   |
| Upload                   | Saved under the next free name: `notes.md` → `notes (1).md` → `notes (2).md` | The upload row says "Saved as notes (1).md: notes.md already exists here", and the finished-uploads toast repeats it |
| Restore from trash       | Same automatic rename if the name was taken meanwhile                        | Toast: "Restored as notes (1).md"                                                                                    |

`nextAvailableName(name, taken)` lives in `packages/shared` (pure function, unit tested): it keeps the extension (`archive.tar.gz` → `archive (1).tar.gz` is acceptable; only the last extension is kept apart, `.tar.gz` handling is not worth it now) and works for folders (`src` → `src (1)`). The database index stays the final judge: on a race, retry with the next name.

### Trash (decision 0007)

- **Trash** sets `trashed_at = now()` on the item and every not-yet-trashed descendant, and `trash_root = true` on the item itself. One recursive query.
- **Trash view** lists `trash_root` items: name, original folder, trashed date, days left.
- **Restore** clears `trashed_at` on the root and on descendants with the **same** `trashed_at` (things trashed separately earlier stay trashed). If the original parent is gone or trashed, it goes to the top level of My Drive, and the toast says so. Name clash → automatic rename + toast.
- **Delete forever** (owner only, with a confirm dialog that says it can't be undone): collect the subtree's storage keys and file sizes, delete the root row (children cascade), release quota, then delete the objects from storage. If storage deletion fails, the keys go to a cleanup job (step 11) so nothing is left behind.
- **Empty trash** deletes every trash root forever.
- **Automatic emptying:** trash roots older than **30 days** are deleted forever by the worker (step 11). (LOCKED.md's "trash emptying in 3 days" notification arrives with notifications in Phase 3.)
- **Quota:** trashed files still count until deleted forever (like Google Drive).
- **Inside a trashed folder:** not reachable from My Drive. Opening a trashed folder's URL shows "This folder is in the trash" with Restore.

### Storage: `packages/storage` (decision 0006)

A new workspace package used by `web` (uploads, downloads) and `worker` (cleanup):

- One `S3Client` from env: `S3_ENDPOINT` (`http://127.0.0.1:3900` locally), `S3_REGION` (`garage` locally, `auto` on R2), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `forcePathStyle: true`.
- Helpers: `presignPut` (signs `Content-Type` and `Content-Length`), `presignGet` (inline or attachment, safe file name via RFC 5987 `filename*`), `headObject`, `deleteObjects` (batches of 1000), multipart: `createMultipart`, `presignPart`, `completeMultipart`, `abortMultipart`, `getRange` (first bytes for text previews).
- `pnpm storage:setup` (script in the package): sets bucket **CORS** through the S3 API so the browser can PUT straight to storage: origins `http://localhost:3000` and `http://localhost:3100` (e2e), methods `PUT`, `GET`, `HEAD`, all headers, expose `ETag` (needed for multipart).
- Every operation the app issues also bumps `usage_counters` (class A or B). Presigned GETs count when the URL is issued (close enough; the real count comes from R2's dashboard).

### Limits and guards (LOCKED.md "Limits")

Checked in `requestUpload` before anything is reserved, in this order, each with a clear message:

1. File ≤ **100 MB** ("Files can be up to 100 MB").
2. Owner's quota: an **atomic** reservation `update users set storage_used = storage_used + size where id = $1 and storage_used + size <= storage_quota` (no read-then-write race). 0 rows → "Not enough space: x of 1 GB used".
3. App-wide: `sum(storage_used) + size ≤ 9 GB` → otherwise "Uploads are paused: the app's storage is full".
4. Operations this month: block at **90%** of R2's free tier (900,000 class A, 9,000,000 class B). The 70% warning is an admin notification in Phase 3; in Phase 2 it's a server log line.

R2's free tier (10 GB, 1 M class A, 10 M class B a month) is re-checked when prod is set up in Phase 6.

### Uploads (diagram 8)

1. **`requestUpload({ parentId, name, size, mimeType })`** server action: session → `can(user, "upload", parent)` → validate name and size → pick the free name → insert a `pending` item → reserve quota → check app-wide guards → return `{ itemId, finalName, renamed, url }` (or part URLs for multipart). Presigned URLs expire after **10 minutes**.
2. **Browser PUT** with `XMLHttpRequest` (fetch has no upload progress), sending the signed `Content-Type`. Up to 3 files at once; the rest queue.
3. **`completeUpload({ itemId, parts? })`**: HEAD the object, check the size matches the reservation exactly (else delete the object, release quota, error), mark `ready`.
4. **`cancelUpload({ itemId })`** on cancel or failure: abort multipart / delete object, release quota, delete the pending row.
5. Anything still `pending` after **1 hour** is cleaned up by the worker (closed tab, crash).

**Large files (50–100 MB, step 7):** multipart with 10 MB parts (at most 10), part URLs presigned up front, 3 parts in parallel, the browser collects each part's `ETag`, `completeUpload` completes the multipart upload, then the same size check.

**UI:** an Upload button and a drop zone over the folder view; an uploads panel (bottom-right) with one row per file: progress bar, cancel, done, error, and the "Saved as …" note when renamed. A toast when a batch finishes. Toasts: shadcn `sonner`.

### Browsing

- Routes: `/drive` (top level of My Drive), `/drive/folders/[folderId]`, `/drive/trash`. `proxy.ts` matcher gains `/drive/:path*`; each page also checks the session and `can(user, "view", item)`. A missing or not-owned item is a **404** (hide that it exists; diagram 7). Signed-in visitors to `/` go to `/drive`.
- Listing: folders first, then files, by name (case-insensitive). **Cursor pagination** (keyset on `(type, lower(name), id)`), 50 per page, "Load more" / infinite scroll with TanStack Query `useInfiniteQuery` (LOCKED.md). The first page renders on the server.
- Breadcrumbs: one recursive query up the parent chain.
- Columns: name with type icon, size, modified. Row menu: Open/Preview, Download, Rename, Move, Move to trash.
- Sidebar: My Drive, Trash, storage meter (`x of 1 GB`).
- Activity-hidden pages: keep the Next.js `<Activity>` lessons (memory note): dialogs reset on hide, no stale upload rows after navigation.

### Download and previews

- `GET /api/items/[id]/download`: session → `can(user, "download", item)` → `presignGet` with `Content-Disposition: attachment` → 302 redirect. Short expiry (1 minute: the browser follows it immediately).
- `GET /api/items/[id]/preview`: inline **only** for an allowlist: images (not SVG), video, audio, PDF. The content type is set by us from the allowlist, not from the upload. Everything else (SVG, HTML, …) is never served inline.
- Text preview: the server reads the first **1 MB** (`getRange`) and shows it in a `<pre>` with a "showing the first 1 MB" note when cut. Text is detected by MIME type + extension list + no NUL bytes in the sample. (Monaco arrives in Phase 4.)
- The preview is a dialog over the folder view; Esc closes it; it resets when hidden.

### Rename and move

- Rename: dialog with the current name selected (without the extension for files). Same name rules; a clash is an inline error.
- Move: dialog with a folder picker (browse folders from My Drive, breadcrumbs inside the dialog). Refused: moving into itself or into one of its own descendants (recursive check), into a trashed folder, or a clash in the target (inline error). Moving to the same folder is a no-op.
- Both are server actions that re-check everything (CLAUDE.md: never trust ids from the client).

### `packages/authz` v0

- `can(user, action, item)` → boolean, with actions `view`, `download`, `upload` (into a folder), `create_folder`, `rename`, `move`, `trash`, `restore`, `delete_forever`.
- Phase 2 rule: allowed if and only if `item.ownerId === user.id`. For "top level of My Drive" (no item), the caller passes the user's root (`{ ownerId: user.id }`).
- A **test grid** from day one: every action × (owner, another user) → allow / deny. Phase 3 adds Editor/Viewer columns, grants inheritance and share links (decision 0002: one SQL function resolves roles).

### Worker: `apps/worker`

- A small Node 24 app (no build step: Node runs the TypeScript directly, like the seed script), started by `pnpm dev` through turbo, and as its own container in prod (Phase 6).
- pg-boss (its own `pgboss` schema; drizzle-kit only manages `public`).
- Scheduled jobs: **`cleanup-pending-uploads`** every 15 minutes (pending > 1 hour: abort multipart, delete object, release quota, delete row); **`empty-trash`** daily (trash roots > 30 days → delete forever); **`delete-storage-objects`** queue for keys whose deletion failed.
- Shared logic (delete forever, release quota) lives in `packages/db` + `packages/storage` so the web app and the worker use the same code.

### Tests

- **Unit:** `nextAvailableName`, name validation, the authz grid, MIME/text detection, the pagination cursor encode/decode.
- **E2E:** one flow test: create a folder → upload a small file (Playwright `setInputFiles`) → preview → rename → move → trash → restore → delete forever → quota back to 0. Plus: a name clash on upload shows "Saved as …".
- **CI:** Garage joins the workflow (started with `docker run` in a step after checkout, because the config file comes from the repo), plus `storage:setup` for CORS. Test files must not land in the dev bucket: decide in step 12 between a separate `devsbucket-test` bucket and a key prefix.

## Steps

Each is one branch and PR. Sizes are rough.

| #   | Step                | Branch                                        | Main pieces                                                                                                                                                                | Verify                                                                                   |
| --- | ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Items schema        | `feat/items-schema`                           | `items` + `usage_counters` schema, indexes, migration; Phase 1 follow-ups (remove release-age exclusions, ruleset merge-only)                                              | Migration SQL reviewed (expression index!), applies to dev and test DB, DBeaver shows it |
| 2   | authz v0            | `feat/authz-v0`                               | `packages/authz` (`can()`, action list), test grid, typecheck/test wiring                                                                                                  | Grid passes in `pnpm test`                                                               |
| 3   | Drive shell         | `feat/drive-shell`                            | `/drive` layout, sidebar, storage meter, proxy matcher, `/` → `/drive` when signed in, TanStack Query provider, sonner                                                     | Signed out → `/sign-in`; empty My Drive shows the empty state                            |
| 4   | Folders + browsing  | `feat/folders`                                | create-folder action + dialog, listing query with cursor pagination, breadcrumbs, folder page, 404 for others' items, `nextAvailableName` + name rules in shared (+ tests) | 60 folders → pagination; another user's folder URL → 404; clash → inline error           |
| 5   | Storage plumbing    | `feat/storage`                                | `packages/storage`, env vars (web `.env.example`), `storage:setup` (CORS), usage counters + guards; decision 0006 already written                                          | A presigned PUT from the browser to Garage works (CORS); guard messages                  |
| 6   | Uploads ≤ 50 MB     | `feat/uploads`                                | request/complete/cancel actions, XHR upload with progress, drop zone, uploads panel, "Saved as" notes                                                                      | Upload, cancel, quota full, name clash, refresh mid-upload                               |
| 7   | Multipart 50–100 MB | `feat/multipart-uploads`                      | multipart in actions + client, part progress, abort                                                                                                                        | A 90 MB file; cancel half-way leaves nothing behind                                      |
| 8   | Download + previews | `feat/previews`                               | download + preview route handlers, preview dialog, text preview                                                                                                            | Each file type; SVG/HTML never inline; another user → 404                                |
| 9   | Rename + move       | `feat/rename-move`                            | rename + move actions and dialogs, folder picker, cycle check                                                                                                              | Clash errors; can't move a folder into its child                                         |
| 10  | Trash               | `feat/trash`                                  | trash/restore/delete-forever/empty actions, Trash page, trashed-folder page, quota release, storage delete                                                                 | Restore to a deleted parent → top level; delete forever frees quota and the object       |
| 11  | Worker              | `feat/worker`                                 | `apps/worker`, pg-boss, the three jobs, turbo dev wiring                                                                                                                   | Abandoned upload cleaned; trash older than 30 days emptied (time faked in a test)        |
| 12  | Tests + review      | `test/drive-e2e`, then `chore/phase-2-review` | unit + e2e flow, Garage in CI, CLAUDE.md, tag `v0.2.0`                                                                                                                     | CI green; tag on the merge commit                                                        |

## Open questions (answered)

- **Step 4:** a "Load more" button (infinite scroll can come later; the button is easier to test).
- **Step 5:** Garage 2.5 supports `PutBucketCors`, and a presigned PUT with a different `Content-Length` or `Content-Type` gets 403. `completeUpload`'s size check stays as the final guard.
- **Step 8:** text previews are read through the server (`loadTextPreview`: a 1 MB range, a NUL-byte check, one decode), not by the browser with a presigned range.
- **Step 12:** a separate test bucket, `<S3_BUCKET>-test` (`pnpm storage:setup-test`), emptied before every e2e run, rather than a key prefix in the dev bucket.

Built as planned, with one change of order: Garage joined CI in step 6, when the web app first imported `@devsbucket/storage`. Progress and notes: `docs/PROGRESS.md`.
