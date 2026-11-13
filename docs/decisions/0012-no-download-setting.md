# 0012: Viewers can always download

Date: 2026-11-13 · Status: accepted (replaces the `viewers_can_download` part of 0008)

## Context

Decision 0008 gave every item a "Viewers can download" setting. When it was off, Download was hidden and the download route returned 403. But previews already send the file's bytes to the Viewer's browser: they can copy code from the preview, or save the image, video or PDF. The setting looked like protection without giving any.

## Decision

- No `viewers_can_download` column and no setting. Every role can download (`can(access, "download")` is true for any role). Migration 0006 drops the column and recreates `item_access()` without it.
- The Owner has one sharing setting left, "Editors can share". It keeps 0008's rules: Owner only, and off on a folder means off for everything inside it.
- Editors keep everything else (edit, upload, rename, move, trash, restore).
- The setting is still sent as `{ setting, value }` (a one-value enum), so a later setting needs no new action or activity shape.

## Why / alternatives rejected

- **Keep the setting and add a note that previews leak:** a switch that doesn't do what its name says is worse than no switch.
- **Block previews too when it's off:** then a Viewer can't view anything, so they'd need a different role.
- **Watermarks or a view-only renderer:** too much work for a developer drive on a $0 budget, and it still wouldn't stop screenshots.
