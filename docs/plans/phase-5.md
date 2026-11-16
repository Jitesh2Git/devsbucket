# Phase 5 plan: Drive extras

Planned 2026-11-16, at the end of Phase 4 (`v0.4.0`). Checklist and progress: `docs/PROGRESS.md`. Decision made for this phase: `docs/decisions/0017-phase-5-scope.md` (no Tiptap notes and no stars; search by name; the simplest shape of Recent, the activity panel, making a copy and ZIP download).

## Goal

Small features that make the drive easier to live in: get back to files you opened (Recent), find anything you can open by name (Cmd+K), see who did what to an item (activity panel), duplicate a file (Make a copy) and take a whole folder home (ZIP download). Every one goes through `packages/authz` like the rest of the app, and none adds a service or a cost.

**Done when:** with `pnpm docker:up` + `pnpm dev`: opening a file puts it at the top of Recent; Cmd+K finds a file in a folder shared with you by part of its name (and with a typo), and opens it; the activity dialog of a file shows its rename, edits and download with who and when, and a Viewer has no Activity item; "Make a copy" puts `notes (copy).md` next to `notes.md` (or at the top of a Viewer's My Drive) and the quota moves; "Download as ZIP" on a folder gives a ZIP with its tree, and a folder over the cap says so instead. Each feature has unit or database tests and e2e, and CI is green.

## Scope

- **In:** Recent, the activity panel, Make a copy (files), ZIP download (folders), Cmd+K search (names). The `copied` activity type. Dropping the unused `note` item type.
- **Out (decision 0017):** Tiptap notes, stars, searching file contents, copying folders or into a picked folder, selecting several items, a ZIP built by the worker, activity for a folder's whole subtree.
- **Out (not planned now):** the follow-ups from Phases 3 and 4 in PROGRESS.md, unless a step touches the same code anyway (each step says so if it picks one up).

## How each step is run

Same as Phases 2–4 (learning mode): one branch and one PR per step, researched and tested in a scratch copy first (`step-scratch`), explained with whole files for the user to write, then verified (`step-verify`). Versions are checked with `npm view` at the time of the step. Each step adds its own tests. Run e2e in CI mode locally (CLAUDE.md).

Versions on 2026-11-16 (check again in each step): `cmdk` 1.1.1 (through `shadcn add command`), `client-zip` 2.5.1, `archiver` 8.0.0, `@aws-sdk/client-s3` 3.1169.0 (`CopyObjectCommand`, `GetObjectCommand`). `pg_trgm` ships with the `postgres:18.6-alpine` image (contrib); step 5 confirms.

## Design

### Recent (step 1)

- **Table `item_views`:** `user_id` (cascade), `item_id` (cascade), `last_opened_at` (timestamp with time zone), primary key `(user_id, item_id)`, index `(user_id, last_opened_at desc)`. Diagram 6 already has it as `ItemView`.
- **Recording** (`recordView(userId, itemId)` in `@devsbucket/db/recent`): an upsert that sets `last_opened_at = now()`, then deletes that person's rows beyond the newest 100 (one statement, like the version cap). Called when a file is opened: the file page (`/drive/files/[fileId]`, after `resolveFile(…, "view")`) and the preview dialog (a small server action the dialog calls when it opens, also through `resolveFile`). Not recorded: folders, downloads, share-link visits (those have their own table).
- **Listing** (`listRecent(userId)`): the newest rows joined to `items`, kept only when `item_access()` still gives a role, the file isn't trashed and is `ready`; the first 50. Shows name, folder (the parent's name, linked), owner when it isn't you, and "opened 2 h ago".
- **Page `/drive/recent`** in the sidebar between My Drive and Shared with me (`drive-nav.tsx`), with the same item list pieces as Shared with me (`item-name.tsx` opens text files in the editor and others in the preview). Empty state: "Files you open show up here."
- The same migration drops `note` from `itemTypes` and the `items` check (decision 0017) and from the few places that list it (`shared-with-me.ts`, `item-name.tsx`, `realtime/src/mode.ts`).

### Activity panel (step 2)

- **Who:** Owner and Editors (`can(access, "view_activity")`, already in the grid). Viewers don't see the menu item.
- **Where:** "Activity" in an item's row menu (`item-menu.tsx`, folders and files) and on the file page header. A dialog, not a side panel (no selection model in the list).
- **Data:** server action `loadActivity({ itemId, before? })` through `resolveItem(…, "view_activity")`, reading `listActivity(itemId, { before, limit: 50 })` (`@devsbucket/db/activity`; the index `(item_id, created_at desc)` exists since Phase 3): rows newest first with the actor's name ("Deleted user" for a removed account, "DevsBucket" when the worker did it). "Show more" loads the next 50 with the last row's time.
- **Text:** `activityText(row)` in `@devsbucket/shared/activity` turns each action and its metadata into one line ("renamed it from `a.md` to `b.md`", "shared it with Bob as Editor", "saved version 4: Fix intro", "downloaded it as a ZIP"), with a unit test that covers every action in `activityActions` (a new type without a text fails it, like the notification groups test). Times as "2 h ago", the exact time on hover.
- A folder shows only its own rows (decision 0017); `deleted_forever` is logged on the parent, so a folder shows "deleted `x` forever".
- **Picked up:** the Phase 4 follow-up "the activity panel reads `edited`, `version_saved`, `version_restored`".

### Make a copy (step 3)

- **`can()`:** a new `copy` action, true for every role (LOCKED.md "Roles": Viewers can copy, decision 0012). The grid test grows.
- **Where it goes:** next to the original when `can(parentAccess, "upload")` (so an Editor's copy in a shared folder belongs to that tree's owner, like an upload), otherwise at the top of the person's My Drive. The name is `notes (copy).md` (base + ` (copy)` + extension; no extension: `Makefile (copy)`), and if taken the usual visible renaming (`notes (copy) (1).md`, decision 0007).
- **Server action `copyFile`** → `copyFile` in `@devsbucket/db/items` in one transaction, like `createTextFile` (Phase 4 step 3): `checkUploadLimits(size)` first (file size, 9 GB, operations), reserve the size in the destination owner's quota (`reserveStorage`, which refuses over the quota), insert the item (`ready`, same `mime_type` and size, `created_by` = the person), log `copied` on the new item with `{ fromId, fromName }`, and copy the object through a callback (`copyObject({ from, to })` in `@devsbucket/storage/objects`, `CopyObjectCommand`, one class A operation) so a storage failure rolls the row back.
- A text file is copied as stored (its last saved version); unsaved live edits, versions and `collab_states` aren't copied.
- **Activity:** `copied` joins `activityActions` (migration recreating the check) and `ActivityMetadata`; `changedFolders` refreshes the destination folder. Notifications: treated like an upload by `planNotifications` (the owner of a folder hears "files added" when someone else's copy lands in it), decided in the step if it's simpler to send none, like New file.
- **UI:** "Make a copy" in a file's row menu and on the file page; a toast "Copied to <folder>" with a link to open it.

### ZIP download (step 4)

- **Who:** any role (`download`), on a folder: "Download as ZIP" in the row menu and the folder page header.
- **Check first:** a server action `checkZip(folderId)` counts the folder's tree (recursive query: not trashed, `ready` files and every folder) and returns the file count and total size, or why not: over `ZIP_MAX_FILES` (1,000) or `ZIP_MAX_BYTES` (1 GB) → "This folder is too big to download as a ZIP (N files, X GB). Download smaller folders." (constants in `@devsbucket/shared/limits`), an empty folder → "This folder is empty.", operations over the hard stop → the usual message. Only then does the browser go to the route, so a refusal is a toast, not a bare error page.
- **Route `GET /api/items/[itemId]/zip`:** checks again (session, `resolveFolder(…, "download")`, the same caps), then streams `Content-Disposition: attachment; filename="<folder>.zip"`: each file read with `GetObject` and piped into the ZIP one after another, paths from the tree (`folder/sub/file.ts`), empty folders as directory entries. No temporary file, no buffering of whole files. Logs `downloaded` on the folder with `{ zip: true, files: N }` (`ActivityMetadata` only, no migration) and counts the reads in `usage_counters`.
- **Library:** `client-zip` (small, Web Streams, returns a `Response`, no compression) or `archiver` (Node streams, deflate). Compression saves bandwidth for code but costs CPU on the 2-core VM; the step measures both on a 200 MB folder and picks.
- If a file can't be read halfway through, the stream is aborted (the browser shows a failed download); nothing is half-written on the server.

### Cmd+K search (step 5)

- **Index:** a custom migration with `create extension if not exists pg_trgm`, then a GIN index `items_name_trgm_idx on items using gin (lower(name) gin_trgm_ops)` (drizzle-kit `--custom` for the extension; the index from the schema if Drizzle can say `gin_trgm_ops`, otherwise in the same custom migration). CI's Postgres service and the test database need the extension too.
- **Query** (`searchItems(userId, q)` in `@devsbucket/db/search`): `q` trimmed, 2–100 characters. Candidates: the person's own items, plus every item inside their access roots (the `accessRoots` CTE from Shared with me, walked down with a recursive CTE); not trashed, `ready` (or folders). Match `lower(name) like '%q%'` (with `%` and `_` escaped) or `word_similarity(q, lower(name)) > 0.4`; order: name starts with `q`, then contains it, then similarity, then newest. 20 results, each with its parent folder's name and the owner when it isn't you.
- **UI:** shadcn `command` (cmdk) in a dialog, opened by Cmd+K / Ctrl+K anywhere under `/drive` and by a search button in the header. Typing waits ~200 ms, then calls the server action. With an empty box it shows the last 5 Recent files. Enter or click opens: a folder → its page, a text file → the editor, another file → the preview dialog (how the palette opens a preview is decided in the step: the preview component mounted by the palette, or the parent folder with the preview open).
- The palette lives in the drive layout, so it's subject to Next's hidden pages (memory: React Activity): reset the query and close it on navigation.

### Live events

None new. `copied` refreshes the destination folder through `changedFolders`; Recent and search fetch when opened; the activity dialog fetches when opened.

### Tests

- **Unit:** `copy` in the authz grid; `activityText` covers every action; the copy name (`notes (copy).md`, no extension, dotfiles); ZIP cap message; search input schema.
- **Database:** `recordView` keeps the newest 100; `listRecent` hides files that were trashed or whose access was removed; `listActivity` pages by time; `copyFile` (row + quota + `copied`, a storage failure leaves no row, over the quota refused, Viewer's copy lands in their own drive); the ZIP tree query (skips trashed and pending files); `searchItems` (finds inside a shared folder, not someone else's unshared file, not trashed, a typo still matches).
- **E2E:** one spec per step: `recent.spec.ts`, `activity.spec.ts`, `copy.spec.ts`, `zip.spec.ts` (unzips the download with Node and checks the paths and one file's text), `search.spec.ts` (Cmd+K, type, Enter opens). Viewer checks in `roles.spec.ts` (no Activity, has Make a copy and Download as ZIP).

## Steps

Each is one branch and PR. Order chosen by the user: small to big.

| #   | Step           | Branch                 | Main pieces                                                                                                                                         | Verify                                                                                                                                      |
| --- | -------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Recent         | `feat/recent`          | `item_views` + migration (also drops `note`), `recordView` on the file page and preview, `listRecent`, `/drive/recent` page and sidebar link        | Migration SQL read; open two files → Recent lists them newest first; trashed or unshared files disappear; 101st view drops the oldest row   |
| 2   | Activity panel | `feat/activity-panel`  | `listActivity`, `activityText` for every action, `loadActivity` action, Activity dialog in the row menu and file page, "Show more"                  | Rename, edit, download a file → three lines with names and times; Viewer has no Activity; unit test fails if an action has no text          |
| 3   | Make a copy    | `feat/make-a-copy`     | `copy` in `can()`, `copied` activity + migration, `copyObject`, `copyFile` (transaction, quota, limits), menu item and toast                        | `notes (copy).md` next to the original with the same content; Viewer's copy at the top of their drive; quota moves; a full drive refuses    |
| 4   | ZIP download   | `feat/zip-download`    | tree query, `checkZip` action, streaming route, caps in `@devsbucket/shared/limits`, `downloaded` with `{ zip: true }`, menu item and header button | ZIP of a nested folder unzips to the same tree; an empty folder and an over-cap folder show a toast; memory stays flat on a 200 MB folder   |
| 5   | Cmd+K search   | `feat/search`          | `pg_trgm` + GIN index migration, `searchItems`, shadcn `command`, palette in the drive layout with Recent when empty, opening each kind of item     | Finds a file in a shared folder by part of its name and with a typo; never someone else's unshared file; Cmd+K opens it from any drive page |
| 6   | Review         | `chore/phase-5-review` | CLAUDE.md conventions (Recent, activity text, copy, ZIP, search), diagrams check, follow-ups from Phase 5, tag `v0.5.0`                             | CI green; tag on the merge commit                                                                                                           |

## Open questions (to answer during the steps)

- **Step 1:** record a view from the file page's server render or from a server action the client calls once (a render with a side effect runs again on refresh and for prefetches); keep 100 rows per person or fewer.
- **Step 3:** whether a copy into someone else's folder sends the owner a "files added" notification (like an upload) or nothing (like New file).
- **Step 4:** `client-zip` or `archiver` (measured); whether the 1 GB / 1,000 files caps fit the 2-core VM, and whether a long download blocks other requests in `next start`.
- **Step 5:** Drizzle and `gin_trgm_ops` in the schema; how a non-text file found by search opens its preview; whether `word_similarity` at 0.4 finds the typos we expect without noise.
- **Phase 6:** a long ZIP stream through Caddy (timeouts); `pg_trgm` in the prod database (same image, so it should just be there).
