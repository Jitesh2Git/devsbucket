# 0017: Phase 5 scope: no Tiptap, no stars, simple extras

Date: 2026-11-16 · Status: accepted

## Context

LOCKED.md and the Phase 5 summary in PROGRESS.md listed Tiptap notes, Cmd+K search, starred and recent, an activity panel, ZIP download and making a copy, without saying how big each one is. Phase 4 already gives every `.md` file a live editor, versions and a live preview. Before planning Phase 5, the user chose what to keep and the smallest useful shape of each (plan: `docs/plans/phase-5.md`).

## Decision

- **Dropped:** Tiptap notes (decision 0003's "Tiptap for rich notes"): Markdown files with the live preview are the notes. The unused `note` item type leaves `itemTypes` and the `items` check. Stars (the `Star` table in diagram 6) aren't built.
- **Search:** names only, of every file and folder the person can open (their own drive and everything under what's shared with them), not trashed. A Cmd+K (Ctrl+K) dialog; matching with `ILIKE` plus `pg_trgm` similarity for typos, a trigram GIN index on `lower(name)`. No search of file contents.
- **Recent:** files only, recorded when a person opens a file (the editor page or a preview) in `item_views` (one row per person per file, the newest 100 kept per person). The Recent page lists the newest 50 that are still accessible and not trashed. Folders aren't recorded.
- **Activity panel:** a dialog from an item's menu (and the file page) with that item's own rows, newest first, 50 at a time, for the Owner and Editors (`view_activity`). A folder shows its own rows, not everything inside it.
- **Make a copy:** files only, for any role (decision 0012), as a new `copy` action in `can()`. The copy goes next to the original as `name (copy).ext` when the person may upload there, otherwise to the top of their My Drive, with the usual visible renaming when taken (decision 0007). One storage `CopyObject`, inside the same transaction as the row; it counts against the quota of the drive it lands in, with the same hard stops as an upload. A text file is copied as stored (its last version); versions and live state aren't copied. Logs `copied` (new activity type, migration).
- **ZIP download:** a whole folder, for any role, from the folder's menu. The web app streams the ZIP straight from storage (one read per file, no temporary file, no worker job), with folder structure and empty folders. Capped at 1 GB and 1,000 files: above that the person is told before the download starts. Logs `downloaded` on the folder.

## Why / alternatives rejected

- **Tiptap notes:** a second editor model, a new item type and a Markdown conversion for diffs, mostly duplicating `.md` + preview. Moving it to a later phase kept a decision nobody needed.
- **Stars:** useful, but Recent and search cover "get back to that file" for one person's drive.
- **Searching contents:** Postgres full-text on the latest version text needs indexing on every upload and version save, and binary files have none; names cover most lookups.
- **Activity for a folder's whole subtree:** richer, but a heavier recursive query and long noisy lists; the item's own rows are enough to answer "who did this".
- **Copy into a picked folder, or copying folders:** a picker and whole-tree copies (many objects, quota up front) for a rarer need; Move already puts the copy elsewhere.
- **ZIP built by the worker** into storage with a link in a notification: survives huge folders, but needs a job, a temporary object, cleanup and a notification type. Streaming with caps is enough for a 1 GB drive.
