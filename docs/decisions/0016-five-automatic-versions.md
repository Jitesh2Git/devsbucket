# 0016: Keep 5 automatic versions per file

Date: 2026-11-15 · Status: accepted

## Context

Decision 0015 kept the newest 50 automatic versions per file. Each version holds the file's full text and doesn't count against the quota, so a 10 MB file could hold ~500 MB of versions, and a 100 MB file ~5 GB. With one automatic version per editing session and named versions for anything worth keeping, 50 is more than needed.

## Decision

Keep the newest **5** automatic versions per file (`MAX_AUTO_VERSIONS`). Version 1, named versions and restore versions are still always kept. Nothing else from decision 0015 changes.

## Why / alternatives rejected

- **50:** a long trail, but up to ~5 GB for one large file, outside the quota.
- **10 or 20:** a middle ground; the user prefers the smallest that still undoes recent sessions, with named versions for the rest.
