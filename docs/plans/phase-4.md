# Phase 4 plan: Live editing

Planned 2026-11-14, at the end of Phase 3 (`v0.3.0`). Checklist and progress: `docs/PROGRESS.md`. Decision made for this phase: `docs/decisions/0013-live-editing.md`.

## Goal

Every text file opens in a Monaco editor on its own page, where everyone with access sees the same document live, with named cursors (Viewers read-only). Hocuspocus runs inside `apps/realtime` and checks every connection with `item_access()` + `can()`. Versions are saved automatically and by hand, any two can be compared in the Monaco diff editor, and an old one can be restored. Markdown files get a live preview. Editors can create a new empty text file. Editing writes activity and the worker sends "file edited" and "old version restored" notifications.

**Done when:** with `pnpm docker:up` + `pnpm dev`, two users in two browsers edit the same file and see each other's text and cursors without reloading; a Viewer sees both but can't type (and the server drops anything they send); leaving the file saves a version and the download has the new content; a named version can be saved, compared with any other version and restored for everyone; a `.md` file shows its preview live; "New file" creates and opens an empty file. The authz grid, version saving and thinning have tests, e2e covers two-browser editing, and CI is green.

## Scope

- **In:** LOCKED.md "Editing" (Monaco, live cursors, versions, diff view) for uploaded text files, the Markdown preview (decision 0003), a "New file" button, the activity types `edited`, `version_saved`, `version_restored`, and the notifications "file edited" and "old version restored".
- **Out (Phase 5):** Tiptap notes (and their Markdown diff), making a copy (the `copied` activity), the activity panel, Recent, stars, search.
- **Out (not planned):** offline editing (y-indexeddb), replacing a binary file by uploading a new version, comments in the editor, editing in the preview dialog.

## How each step is run

Same as Phases 2 and 3 (learning mode): one branch and one PR per step, researched and tested in a scratch copy first (`step-scratch`), explained for the user to build, then verified (`step-verify`). Versions are checked with `npm view` at the time of the step. Each step adds its own tests.

Versions on 2026-11-14 (check again in each step): `@hocuspocus/server` and `@hocuspocus/provider` 4.8.0 (Node ≥ 22, peers `yjs` ^13.6.8 and `y-protocols` ^1.0.6), `yjs` 13.6.33, `y-protocols` 1.0.7, `y-monaco` 0.1.6 (peers `monaco-editor` ≥ 0.20, `yjs` ^13.3.1), `monaco-editor` 0.57.0, `@monaco-editor/react` 4.7.0 (React 19 and `monaco-editor` < 1), `react-markdown` 10.1.0, `remark-gfm` 4.0.1.

## Design

### What can be edited (decision 0013)

- A file is **editable** when `previewKind()` says `text` (extension, name or `text/*`, as today) and its content is UTF-8 without NUL bytes (`TextDecoder` with `fatal: true`). Checked on the server when the document is first loaded; a file that fails opens read-only with "This file isn't UTF-8 text, so it can't be edited" and keeps preview and download.
- **No size limit** (LOCKED.md "Live editing"): any text file up to the 100 MB upload limit opens in the editor. Step 4 measures how a 10 MB and a 100 MB file behave (load time, memory in realtime and the browser); if it's unusable, a limit comes back to the user as a new decision, not silently.
- A **trashed** file opens read-only with the trashed banner; trashing it while people edit closes their connections (they reload into the banner).
- When the **owner's storage is full** the file opens read-only with "<owner>'s storage is full". This is the hard stop LOCKED.md asks for every limit.

### Data model

New tables (ids `uuid` with `uuidv7()`, timestamps with time zone, text + check instead of enums). Names follow diagram 6 (`CollabState`, `ItemVersion`):

| Table           | Columns                                                                                                                                                                                                                                                                                                         | Keys and indexes                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `collab_states` | `item_id` (primary key, cascade), `state` (bytea: the Yjs document as one update), `updated_at`                                                                                                                                                                                                                 | primary key `item_id`                                                                             |
| `item_versions` | `id`, `item_id` (cascade), `number` (int, 1, 2, … per file), `kind` (`auto`, `named`, `restore`), `message` null, `content` (text), `size` (bigint, UTF-8 bytes), `authors` (uuid[], who changed it since the last version), `restored_from` (set null), `created_by` (set null; null for `auto`), `created_at` | unique `(item_id, number)` named `item_versions_item_number_unique`; `(item_id, created_at desc)` |

New column on `items`: `versions_size` (bigint, default 0): the bytes of all its versions, kept in the same transaction as every version insert and thinning, so the quota code adds one column instead of summing versions.

- Drizzle 0.45 has no `bytea` column: a small `customType` (`Buffer` ↔ `bytea`) in `schema/collab.ts`. Check in step 1 whether a newer Drizzle has one.
- `authors` has no foreign key (Postgres can't on arrays); the history shows "Deleted user" for an id with no row.
- Version 1 (`auto`, no authors) is the file's content when it was first loaded, so the first diff has something to compare with.
- Both tables go when the item is deleted forever (cascade); the quota code releases `size + versions_size`.

### Quota (decision 0013)

Versions count against the owner's quota, like trashed files (decision 0007):

- **Saving a version** reserves `version size` with `reserveStorage` and adds it to `items.versions_size`, and the file's new `size` replaces the old one (difference reserved or released), all in one transaction. Over quota → no version is written, the document keeps its live state in `collab_states` (not counted: it's the working copy), and every connection is told "storage full" and becomes read-only.
- **Thinning** (worker, daily) releases what it deletes.
- **Every place that sums bytes today** adds `versions_size`: delete forever and empty trash (`trash.ts`), ownership transfer (`transfers.ts`), remove user (`cleanup.ts`), cancelling or abandoning an upload (no versions yet, so nothing changes there).
- `collab_states` isn't counted. It's at most one Yjs state per file and is deleted with the file.

### Hocuspocus inside `apps/realtime`

Checked in scratch on 2026-11-14 with Hocuspocus 4.8.0: it runs next to the existing `ws` server in the same process, on its own path.

- `server.on("upgrade")` routes by path: `/collab` → Hocuspocus, anything else → today's events socket. The `Origin` check stays in front of both.
- One `new Hocuspocus({ … })` instance (not `Server`, which would open its own port). For each socket: `const connection = hocuspocus.handleConnection(ws, new Request(url, { headers }), context)`, then the integration feeds it: `ws.on("message", (data) => connection.handleMessage(new Uint8Array(data)))` and `ws.on("close", (code, reason) => connection.handleClose({ code, reason: reason.toString() }))`. **Hocuspocus 4 doesn't listen on the socket itself**: without these the provider connects and nothing happens (seen in scratch). `connection.touch()` from a pong handler if we ping.
- The **document name is the item id**. One provider per open file page.
- Config: `debounce` ~2 s and `maxDebounce` ~10 s for `onStoreDocument` (the Yjs state in Postgres is cheap), `unloadImmediately: true` so the last person leaving stores at once. `flushPendingStores()` on shutdown, next to closing the events socket.
- `apps/realtime` gains `@devsbucket/storage`, `@devsbucket/authz`, `yjs`, `y-protocols`, `@hocuspocus/server`, and the `S3_*` values in its `.env` (and in CI and the e2e `webServer` entry, which use the test bucket).

### Auth and permissions for editing

- **`packages/authz`:** two new actions, `edit` and `view_versions`, both Editor and Owner (LOCKED.md "Roles": Editors edit and see version history; Viewers see live cursors read-only). Saving a named version and restoring need `edit` + `view_versions`. The grid test grows to cover them.
- **`onAuthenticate`** (Hocuspocus calls it before the document loads): the session from the request's `Cookie` header through the web app's `/api/auth/get-session` (shared with the events socket), then `getAccess(userId, documentName)`:
  - no row or not a file → reject (the provider gets `authenticationFailed`);
  - no role → reject;
  - role but not `can(access, "edit")`, or trashed, or not editable, or the owner's storage full → `connectionConfig.readOnly = true`. Scratch confirmed a read-only connection's changes never reach the document or `onStoreDocument`.
  - returns `{ userId, name, role }` as the connection's context (used for activity and version authors).
  - The provider needs a `token` to run `onAuthenticate`; it sends a dummy one (the cookie is what counts).
- **Access changing mid-session:** realtime already turns activity into `access-changed` for the people affected. For those users it also closes their `/collab` connections (`connection.close()` on the ones whose context matches); the provider reconnects and `onAuthenticate` decides again (read-only, or rejected → "You no longer have access"). The same for `trashed` and `moved` out of a shared folder.

### Loading and storing

- **`onLoadDocument`:** if `collab_states` has a row, apply its `state` to the document. Otherwise read the object from storage (`getObject` through `packages/storage`, counted in `usage_counters`), check it's editable text, fill `document.getText("content")` and write version 1 (`auto`) in one transaction. The Monaco binding uses the same `Y.Text` name, `"content"`.
- **`onStoreDocument`** (debounced): upsert `collab_states.state = Y.encodeStateAsUpdate(document)`. Add the connection's user to the document's in-memory "changed by" set from `onChange` (`context.userId`, skipping read-only connections, which can't change it anyway).
- **Versions** (below) are written from the same hooks, not on every store.
- The object in storage is rewritten **only when a version is saved** (one `PutObject` each, an R2 class A operation), so downloads and previews are at most five minutes behind someone typing, and exact once everyone has left.

### Versions (decision 0013)

| Kind      | When                                                                                             | Message             | Kept                                                      |
| --------- | ------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------- |
| `auto`    | every 5 minutes while the content differs from the last version, and when the last person leaves | none                | 30 days, then one per file per day (the last of that day) |
| `named`   | "Save version" in the editor (Editor or Owner), with a message (required, up to 200 characters)  | the user's          | forever                                                   |
| `restore` | restoring an old version                                                                         | "Restored from v12" | forever                                                   |

- Saving a version: if the text equals the last version's, nothing happens (no empty versions). Otherwise, in one transaction: insert the version (next `number`), update `items.size`, `versions_size` and `updated_at`, quota, activity; after commit, `PutObject` the new content. If the `PutObject` fails, the next version save writes the object again (the version row already holds the text); step 6 tries it with Garage stopped and decides whether a worker retry is needed.
- "Every 5 minutes" is a timer per loaded document in realtime (started on the first change, cleared on unload), not a worker job: only realtime has the live document.
- A **named** version from the browser goes through Hocuspocus's stateless messages (`provider.sendStateless(JSON.stringify({ type: "save-version", message }))` → `onStateless`), so realtime saves exactly the live text; it checks the connection isn't read-only and that `can(access, "edit")` still holds. The answer comes back as a stateless message to that connection.
- When a version is saved, realtime broadcasts a stateless `versions-changed` to the document's connections, so an open history panel refetches.
- **Thinning:** a worker job `thin-versions`, daily at 04:30 UTC: for each file, `auto` versions older than 30 days except the newest one of each day are deleted, `versions_size` and quota released in the same transaction. Version 1 is kept (the first diff base). A unit-tested pure function picks which to keep.

### Version history and the diff view

- A **History** panel on the file page (Editors and Owner, `view_versions`): newest first, each with number, kind, message, authors, time and size. Server action `listVersions(fileId)` through `resolveFile(…, "view_versions")`.
- **Compare:** pick any two versions (default: the selected one against the current text) → the Monaco `DiffEditor` from `@monaco-editor/react`, side by side, with an inline toggle, read-only. Version contents come from `getVersion(fileId, versionId)`; "current" is the live `Y.Text`.
- **Restore** (Editor or Owner): confirm → a stateless `restore-version { versionId }` to realtime, which checks access, replaces the `Y.Text` content in one Yjs transaction (everyone's editor updates), saves a `restore` version and logs `version_restored`. Restoring through realtime keeps one writer of the live document; a web server action would have to reach into realtime anyway. Realtime still uses `getAccess` + `can()` (CLAUDE.md: every realtime handler goes through authz).
- Viewers don't see History, Save version or Restore.

### The file page and the editor

- **`/drive/files/[fileId]`**: header with breadcrumbs, name, role badge, presence avatars, connection status ("Saved", "Saving…", "Offline, reconnecting"), Save version, History, Download. `resolveFile(…, "view")` decides 404 / "You need access" like folder pages. Clicking a text file in a folder opens this page; other files keep the preview dialog. The preview dialog gets an "Open in editor" button for text files.
- **Monaco without a CDN:** `@monaco-editor/react` loads Monaco from jsDelivr by default. We bundle the `monaco-editor` package and point the loader at it (`loader.config({ monaco })`), because `y-monaco` imports `monaco-editor` itself and two copies break the binding. Loaded only in the browser (`next/dynamic` with `ssr: false`). Step 2 checks Turbopack, the editor's web workers, and the bundle size; that's this phase's biggest unknown.
- **Language** from the extension (Monaco's built-in languages); theme follows the app's light/dark mode.
- **Live:** a `HocuspocusProvider` (URL `NEXT_PUBLIC_REALTIME_URL` + `/collab`, `name` = file id) and `new MonacoBinding(ytext, editor.getModel(), new Set([editor]), provider.awareness)`. Destroy both on leave (Next.js 16 keeps hidden pages alive, memory `nextjs16-activity-state`: tie them to the component's lifetime and check a hidden page doesn't keep its socket).
- **Cursors:** awareness `user: { name, color }`, color picked from the user id so it's stable; y-monaco adds `yRemoteSelection-<clientId>` classes, styled with a small CSS block that a component writes for the current awareness states (name label above the caret). Viewers' cursors show too (LOCKED.md: "see live cursors read-only").
- Read-only connection → `editor.updateOptions({ readOnly: true })` and a badge saying why (Viewer, trashed, not UTF-8, storage full).

### Markdown preview (decision 0003)

- `.md` / `.markdown` files get a split view: editor left, preview right, with a toggle (Editor / Split / Preview) remembered per browser. Read-only users default to Preview.
- `react-markdown` + `remark-gfm` (tables, task lists, strikethrough), rendered from the live `Y.Text` on each change (throttled ~150 ms). **No raw HTML** (react-markdown's default); links get `rel="noopener noreferrer"`; images only load `https:` URLs (relative images in the drive: later).
- Styled with Tailwind's typography plugin if it fits the black-and-white UI, otherwise a few hand-written styles; decided in step 8.

### New text file

- "New file" next to "New folder" in a folder (needs `upload`): a dialog with the name (default `untitled.md`, typed names get the usual unique-name error, decision 0007) → server action creates the item (`status: ready`, size 0, `storageKey: items/<id>`), puts an empty object, logs `created` (with `{ type: "file" }` added to its metadata), then navigates to `/drive/files/<id>`.
- The name must be editable text (`previewKind` = text); otherwise "Use a text file extension, like .md or .txt".

### Activity (decision 0010, 0013)

New `activityActions` with a migration that recreates the check:

| Action             | When                                                                                                                                 | Actor           | Metadata                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ---------------------------------------------------------------------------- |
| `edited`           | once per person per editing session: when their last connection to the file closes, or when the document unloads, if they changed it | the editor      | `{ versionNumber }` (the version that holds their changes, if one was saved) |
| `version_saved`    | a **named** version only (automatic ones would flood the log; `edited` covers them)                                                  | who saved it    | `{ versionNumber, message }`                                                 |
| `version_restored` | restoring                                                                                                                            | who restored it | `{ versionNumber, from }`                                                    |

- They're written by realtime, which now calls `logActivity(tx, …)` (the same function, so the `notify-activity` job and the `devsbucket_events` notify happen in the transaction as usual).
- `changedFolders` in `@devsbucket/shared/realtime`: `edited` and `version_restored` change the parent folder's listing (size, modified time) → `folder-changed`.

### Notifications

| Type               | Group        | Recipient | Rule                                                                                |
| ------------------ | ------------ | --------- | ----------------------------------------------------------------------------------- |
| `file_edited`      | Your folders | the Owner | from `edited`, at most once per file per hour (LOCKED.md); not batched across files |
| `version_restored` | Your folders | the Owner | from `version_restored`, one per restore                                            |

- Added to `notificationTypes` (migration for the check), `notificationGroups` ("A file is edited", "An old version is restored") and `notificationText`. Never to the actor; switches and mutes through `wantsNotification`.
- "Once per file per hour": `planNotifications` asks for a per-item batch window, like the folder batching (reuse the batching code with the file as the key instead of the folder; decide in step 10 by reading it).

### Live events

- New `ServerMessage`? None needed: file pages hear everything through Hocuspocus (document changes, stateless `versions-changed`), folder pages through the existing `folder-changed`.
- `access-changed`, `trashed`, `moved` also close the affected `/collab` connections (above).

### Tests

- **Unit:** authz grid with `edit` and `view_versions`; `isEditableText(bytes)` (UTF-8, NUL, BOM); which versions thinning keeps; the per-file hourly rule for `file_edited`; cursor color from user id; language from extension.
- **Database:** saving a version (number increments, sizes and quota move, same text → no version, over quota → refused); thinning releases bytes; delete forever and transfer include `versions_size`.
- **Realtime:** a Node test (Vitest in `apps/realtime`, against the test database and bucket) that runs Hocuspocus with two `HocuspocusProvider`s in Node 24 (it has a global `WebSocket`): edits reach the other provider, a Viewer's edits are dropped, no cookie → rejected, last leave → a version and the object updated. Decide in step 4 whether this is worth it next to e2e.
- **E2E:** two browser contexts: both type and see each other's text and a named cursor; Viewer can't type; leave → download has the new text; save named version → compare → restore → both editors show the old text; `.md` preview updates; New file → editor opens. Typing into Monaco with Playwright: click the editor and `keyboard.type` (Monaco's hidden textarea; check in step 5).

## Steps

Each is one branch and PR.

| #   | Step                    | Branch                                          | Main pieces                                                                                                                                                                                                         | Verify                                                                                                                                 |
| --- | ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Editing schema + authz  | `feat/editing-schema`                           | `collab_states`, `item_versions`, `items.versions_size`, bytea `customType`, activity and notification types in the checks (one migration), `edit` / `view_versions` in `can()`                                     | Migration SQL read; grid passes; a Viewer can't `edit`; `pnpm test:db` still green                                                     |
| 2   | File page (read-only)   | `feat/file-page`                                | `/drive/files/[fileId]`, bundled Monaco (no CDN), language and theme, text rows open it, "Open in editor" in the preview, `isEditableText`                                                                          | Opens a `.ts` file highlighted; no request to jsDelivr; non-UTF-8 file says why; someone else's file → "You need access"               |
| 3   | New text file           | `feat/new-text-file`                            | "New file" dialog and action, empty object, `created` with type, opens the page                                                                                                                                     | `notes.md` created and opened; duplicate name error; `.png` name refused; Viewer has no button                                         |
| 4   | Hocuspocus in realtime  | `feat/collab-server`                            | `/collab` route, `handleConnection` wiring, `onAuthenticate` with `getAccess` + `can()`, load from storage / `collab_states`, debounced store, closing connections on access change, S3 env in realtime, CI and e2e | Node script or test: two providers sync; Viewer read-only; no cookie rejected; restart keeps the text; 10 MB and 100 MB files measured |
| 5   | Live editor and cursors | `feat/live-editor`                              | `HocuspocusProvider` + `MonacoBinding`, presence avatars, named cursors, status, read-only badges, cleanup on leave                                                                                                 | Two browsers type and see each other; Viewer can't type; access removed → editor reloads read-only or leaves                           |
| 6   | Versions                | `feat/versions`                                 | 5-minute timer, save on last leave, named versions (stateless), object rewrite, sizes and quota, `edited` / `version_saved` activity, storage-full read-only                                                        | Leave → version + download updated; same text → no version; quota moves; over quota → read-only                                        |
| 7   | History, diff, restore  | `feat/version-history`                          | History panel, `listVersions` / `getVersion`, Monaco `DiffEditor` for any two, restore through realtime, `version_restored`                                                                                         | Compare v1 with current; restore → both browsers show it, new `restore` version; Viewer sees no History                                |
| 8   | Markdown preview        | `feat/markdown-preview`                         | split view with toggle, `react-markdown` + `remark-gfm`, no raw HTML, safe links and images                                                                                                                         | Preview follows typing in the other browser; `<script>` shown as text; table and task list render                                      |
| 9   | Quota everywhere        | `feat/versions-quota`                           | `versions_size` in delete forever, empty trash, transfer, remove user; `thin-versions` worker job                                                                                                                   | Delete forever releases versions too; transfer moves them; thinning keeps one a day and releases bytes                                 |
| 10  | Editing notifications   | `feat/editing-notifications`                    | `file_edited` (once per file per hour) and `version_restored` in the worker, switches, texts                                                                                                                        | Two editing sessions in an hour → one notification; owner editing gets none; switch off → none                                         |
| 11  | Tests + review          | `test/editing-e2e`, then `chore/phase-4-review` | two-browser e2e flows, CLAUDE.md (collab path, realtime env, file page), LOCKED.md and diagrams check, tag `v0.4.0`                                                                                                 | CI green; tag on the merge commit                                                                                                      |

## Open questions (to answer during the steps)

- **Step 1:** does Drizzle 0.45 (or a newer one) have a `bytea` column, or do we keep a `customType`; `uuid[]` with Drizzle (`uuid().array()`).
- **Step 2:** Monaco with Next.js 16 and Turbopack: bundling `monaco-editor` (workers: `MonacoEnvironment.getWorker` with `new Worker(new URL(…, import.meta.url))`), what that adds to the page's JavaScript, and whether `@monaco-editor/react` is still worth it or we use `monaco-editor` directly (y-monaco needs the editor instance either way).
- **Step 4:** how big files behave with no size limit (load from storage into Yjs, memory in realtime, Monaco in the browser); whether a realtime test in Vitest is worth it next to e2e; what Hocuspocus's `timeout` does to idle tabs and whether we ping.
- **Step 5:** one WebSocket per tab for both events and collab (`HocuspocusProviderWebsocket` can share a socket between documents, but not with our events protocol) or two; two is simpler. Cursor label styling with y-monaco's classes.
- **Step 6:** what happens to a version when `PutObject` fails (retry on the next save, or a worker retry like deletes); where the 5-minute timer lives across a realtime restart (it's lost; the next change starts it again, and `collab_states` keeps the text).
- **Step 7:** restoring through a stateless message vs `openDirectConnection` from a job (restore when nobody has the file open still needs the document loaded).
- **Step 10:** reuse the folder batching for "once per file per hour", or a simpler "skip if one was sent for this file in the last hour".
- **Phase 6:** `/collab` behind Caddy is the same `wss://` site as the events socket; Hocuspocus memory on the 12 GB VM.
