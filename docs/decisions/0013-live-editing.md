# 0013: Live editing: storage, versions and limits

Date: 2026-11-14 · Status: accepted

## Context

LOCKED.md "Editing" and decision 0003 say what Phase 4 does (Monaco + Yjs + Hocuspocus for every text file, versions saved automatically and by hand, Monaco diff view) but not where the live documents and versions are kept, how many versions survive on a $0 budget, what "text file" means, or who pays for versions in the quota. Plan: `docs/plans/phase-4.md`.

## Decision

- **What can be edited:** files that `previewKind()` calls text and whose content is UTF-8 with no NUL bytes. **No size limit**, as LOCKED.md says: any text file up to the 100 MB upload limit opens in the editor. Others stay preview and download.
- **Storage:** everything in Postgres. The live Yjs state is one row per file in `collab_states`; every version's full text is a row in `item_versions`. Nothing new in R2: the file's object is rewritten once per saved version, so downloads and previews stay current.
- **Saving:** an automatic version every 5 minutes while the text differs from the last version, and when the last person leaves; a named version with a message whenever an Editor or the Owner asks; a version each time an old one is restored. Identical text never makes a new version.
- **Keeping:** named and restore versions forever. Automatic versions for 30 days, then one per file per day (the last of the day), thinned by a daily worker job. Version 1 (the content before the first edit) is kept.
- **Quota:** versions count against the owner's quota, like trashed files (decision 0007), tracked in `items.versions_size`. The live state in `collab_states` doesn't. When the owner's storage is full, files open read-only (the hard stop LOCKED.md asks for).
- **Activity:** `edited` once per person per editing session; `version_saved` only for named versions (automatic ones would flood the log); `version_restored`.
- **Where it runs:** Hocuspocus inside `apps/realtime`, on the `/collab` path of the same server as the events socket, with the same `Origin` and session checks; `onAuthenticate` uses `item_access()` + `can()` and makes Viewer connections read-only. Restoring a version goes through realtime too, so the live document has one writer.
- **Scope:** a "New file" button (empty text file) joins Phase 4. Tiptap notes and making a copy stay in Phase 5.

## Why / alternatives rejected

- **Versions as objects in R2:** keeps the database smaller, but every save and every diff costs R2 operations against the free tier, needs cleanup jobs for orphans, and loses the single transaction that keeps sizes and quota right. Text versions are small next to a 200 GB disk.
- **A size limit for editing (1–5 MB):** suggested because Monaco and Yjs slow down on very large files. The user kept "no size limit"; step 4 measures 10 MB and 100 MB files and brings a limit back as a new decision only if the editor is unusable.
- **Keeping every version forever, or a fixed count per file:** forever grows without bound on a $0 budget; a count would drop a busy file's history within a day. Thinning keeps recent detail and a daily trail.
- **Versions free of quota:** someone could fill the disk by editing; counting them keeps the limits honest.
- **Logging `version_saved` for automatic versions:** one row every 5 minutes per file says nothing that `edited` doesn't.
- **A separate collab server:** another process, port, `.env` and container in Phase 6, for no gain; the existing realtime app already has the session check and LISTEN.
