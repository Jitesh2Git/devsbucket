# 0015: Simpler versions, no editing notifications

Date: 2026-11-15 · Status: accepted

## Context

Decision 0013 planned versions every 5 minutes while people type, thinned to one a day after 30 days by a worker job, counted against the owner's quota (with `items.versions_size` kept right in delete forever, trash, transfer and remove user), plus "file edited" and "old version restored" notifications. Before building step 6, the user asked for something simpler that's still useful.

## Decision

- **When:** one automatic version when the last person leaves the file (one per editing session, only if the text changed), and a named version whenever someone clicks "Save version" and gives a message. No 5-minute timer.
- **How many:** the newest 50 automatic versions per file; older automatic ones are deleted when a new one is saved. Named and restore versions are kept. Version 1 (the text before the first edit) is kept, so there's always a starting point to compare with.
- **Quota:** versions don't count against it. `items.versions_size` is dropped. The file's own size still counts, and changes when a version rewrites the file in storage.
- **Notifications:** none for editing. `file_edited` and `version_restored` leave `notificationTypes` (and the profile switches).
- **Activity** stays minimal: `edited` (once per person per editing session), `version_saved` (named versions), `version_restored`. One row each, nobody is notified.
- This replaces those parts of decision 0013; its storage, auth and editor choices stand.

## Why / alternatives rejected

- **Every 5 minutes:** more restore points, but a timer per open file and many near-identical rows. A version per editing session plus named versions covers "go back to how it was".
- **Thinning by day with a worker job:** keeps a long daily trail, but needs a scheduled job and its tests. A cap of 50 is one delete in the same transaction as the save.
- **Counting versions against the quota:** honest about disk use, but it touches every place that adds up bytes (delete forever, empty trash, transfer, remove user). With a cap of 50 automatic versions per file, the database stays bounded; the 200 GB disk is the backstop.
- **Editing notifications:** the owner would hear about every editing session; the user finds that too much.
