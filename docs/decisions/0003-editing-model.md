# 0003: Monaco for every text file, Tiptap for rich notes
Date: 2026-11-11 · Status: accepted

## Context
Every editable file (code, `.md`, `.txt`, `.env`, `.vue`, ...) should support live editing with cursors and git-like history.

## Decision
- **Monaco + y-monaco** edits every file that's detected as text. There's no size limit.
- **`.md` files** get a live preview pane beside the editor.
- **Tiptap + Yjs** is used only for rich "notes" created inside the app.
- **Binary files** are preview-only, and are replaced by uploading a new version.
- **Versions** are saved automatically and manually. The diff view uses the Monaco diff editor. For Tiptap notes, both versions are converted to Markdown first.

## Why / alternatives rejected
- **Tiptap for `.md` files:** converting Markdown into Tiptap's format and back changes the file (spacing, tables, HTML, frontmatter). Also, everyone editing a file live has to use the same editor model.
- **Tiptap's built-in version comparison:** it's a paid add-on.
- **End-to-end encrypted Vault for secrets:** considered and declined.
