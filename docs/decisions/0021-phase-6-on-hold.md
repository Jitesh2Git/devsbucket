# 0021: Phase 6 on hold, DevsBucket stays local

Date: 2026-11-28 · Status: accepted

## Context

Phase 6 (`docs/plans/phase-6.md`, decision 0020) puts DevsBucket on an Oracle Always Free Arm VM. Steps 1 and 2 are done: the Docker images, `docker/compose.prod.yml` with the Caddyfile, the prod-like stack on the Mac, and CI pushing arm64 images to GHCR. Step 3, the VM itself, never happened: Oracle's Mumbai region (this account's home region, which can't change) kept answering "out of capacity" for the A1 shape. The other ways out were each worse for a permanent $0 budget: Pay As You Go puts a card on file with no hard spending cap, other clouds' free VMs are too small or end after a trial, and splitting the app over free managed services would redesign realtime, events and secrets.

## Decision

- **Phase 6 is on hold, not dropped.** DevsBucket runs locally only (Docker Compose on the Mac), and there is no prod environment for now.
- **The Phase 6 plan stays as it is** (`docs/plans/phase-6.md`, decision 0020, steps 3–8 unticked in PROGRESS.md), for a later attempt: Oracle if A1 capacity frees up, another free host, or a paid one if that's ever chosen. Whichever it is gets its own decision note before step 3 starts.
- **What steps 1 and 2 built stays:** the Dockerfiles, `compose.prod.yml`, the Caddyfile, `pnpm prodlike`, the smoke test, and the CI `images` job that pushes to GHCR on `main` (free, and it keeps the Dockerfiles from breaking unnoticed).
- **LOCKED.md keeps the prod stack as the plan** and says it's on hold; its Hosting and Environments rows point here.

## Why / alternatives rejected

- **Oracle Pay As You Go:** Always Free resources stay free and capacity is easier to get, but Oracle has budget alerts, not a hard cap, so a mistake costs money. LOCKED.md already says never to upgrade.
- **A new Oracle account in another region:** against Oracle's one-free-account rule.
- **A home server behind a tunnel:** possible later with small changes (amd64 images, TLS at the tunnel, backups elsewhere), but not wanted now.
- **Free managed services (Vercel, Render, Koyeb, Neon, Supabase):** they sleep or suspend, break `LISTEN/NOTIFY` through poolers, and split the cookie the realtime server checks across domains: a redesign, not a deploy.
- **Google Cloud e2-micro, AWS, Azure:** 1 GB of RAM isn't enough for the stack, and the others' free tiers end.
