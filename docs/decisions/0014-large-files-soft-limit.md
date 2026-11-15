# 0014: Large files open in the editor only when asked

Date: 2026-11-15 · Status: accepted

## Context

Decision 0013 kept "no size limit" for live editing and asked step 4 and 5 to measure big files before deciding again. Measured on 2026-11-15:

- Server (realtime): a 10 MB file opens in 0.27 s and holds ~175 MB while open; 100 MB opens in 1.4 s and holds ~630 MB.
- Browser (Monaco + y-monaco): 10 MB is live in 1.5–3.4 s; 100 MB in 8–12 s (36 s when reopened while the previous save was still running) and ~0.8 GB in the tab. Typing is normal once loaded.

So 100 MB works, but it's slow to open and heavy on both sides.

## Decision

- Still **no hard limit**: any text file up to the 100 MB upload limit can be edited live.
- A **soft limit of 10 MB** (`LARGE_EDIT_BYTES` in `@devsbucket/shared/editing`): above it, the file page first says the file is large and that opening it can take a while and use a lot of memory, with "Open in editor" (and Download in the header). The editor connects only after the click, and while it loads it says "Loading a large file (N MB). This can take a while."
- Decision 0013's other choices stand.

## Why / alternatives rejected

- **A hard limit at 10 or 25 MB** (bigger files preview and download only): suggested, but the user wants big files editable; telling them first keeps the choice theirs.
- **No warning at all**: a 100 MB file would show a spinner for ~10 s with no reason, and anyone opening it by accident pays ~1 GB in the tab.
