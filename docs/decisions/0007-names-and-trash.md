# 0007: Unique names per folder, 30-day trash

Date: 2026-11-12 · Status: accepted

## Context

Google Drive allows several items with the same name in one folder and keeps trash for 30 days. DevsBucket is a developer drive: paths should mean something, and the Phase 5 ZIP download needs distinct names.

## Decision

**Names**

- Names are unique within a folder, ignoring upper/lower case, among items that aren't in the trash (a partial unique index in Postgres is the final judge).
- The user always sees what happened, nothing is renamed silently:
  - **New folder, rename, move:** refused with an inline error ("A file or folder named "x" already exists here"); the user picks another name.
  - **Upload:** saved under the next free name (`notes.md` → `notes (1).md`), and the upload row and the finished toast say "Saved as notes (1).md: notes.md already exists here".
  - **Restore from trash:** the same automatic rename, with a toast "Restored as …".

**Trash**

- Trashing an item also trashes everything inside it; the Trash view lists only what the user trashed.
- Restore brings back the item and what was trashed with it (not things trashed separately earlier). If its folder is gone or trashed, it goes to the top level of My Drive, and the user is told.
- Items stay in the trash for **30 days**, then the worker deletes them forever. Trashed files still count against the quota until then.
- Delete forever and Empty trash are owner-only, behind a confirm dialog that says they can't be undone.

## Why / alternatives rejected

- **Duplicates allowed (Google Drive):** ambiguous paths and ZIP downloads; replaced by unique names with visible auto-rename for uploads.
- **Silent auto-rename everywhere:** rejected; for actions where the user typed the name (new folder, rename, move), asking is clearer than renaming.
- **Replace on upload:** needs versions to be safe (Phase 4); until then, keeping both is the safe default.
- **Shorter or no automatic emptying:** 30 days matches what people expect from Google Drive, and LOCKED.md already plans a "trash emptying in 3 days" notification.
