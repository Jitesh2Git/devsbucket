# Phase 6 plan: Production

Planned 2026-11-23, after Phase 5 (`v0.5.0`) and the pre-Phase-6 UI fixes (PRs #62–#64). Checklist and progress: `docs/PROGRESS.md`. Decision made for this phase: `docs/decisions/0020-production-setup.md` (the VM stays 2 cores / 12 GB, images built on GitHub's ARM runners and kept in GHCR, an idle stop is monitored and restarted rather than prevented, UptimeRobot and Healthchecks.io for alerts, `age`-encrypted backups).

## Goal

DevsBucket running for real people at `https://devsbucket.duckdns.org` on the Oracle Always Free VM, for $0: HTTPS through Caddy, files in Cloudflare R2, the database on the VM with nightly encrypted backups in Oracle Object Storage, and every merge to `main` deployed automatically after CI, with a backup before migrations, a health check and a rollback. Nothing here adds a paid service, and prod secrets never leave the server (LOCKED.md "Environments").

**Done when:** a merge to `main` is live within minutes without touching the server; a deploy whose health check fails puts the previous version back on its own; on the live site you can sign up with an invite (email and GitHub), upload a 60 MB file (multipart, straight to R2), edit a text file live with a second browser, download a folder as a ZIP and get notifications; last night's backup is in Object Storage, a missed backup emails you, and the restore drill brings it back into a scratch database on the VM; UptimeRobot emails you when the site is down; the runbook explains the VM, the restart after an idle stop, a restore, and rotating each secret.

## Scope

- **In:** Docker images for web, realtime and worker; the prod Compose file and Caddyfile; images built in CI and stored in GHCR; the VM set up by hand from a runbook; DuckDNS; R2 (bucket, scoped token, CORS); the prod GitHub OAuth app; secrets on the server; the deploy workflow and script with backup, migrations, health check and rollback; nightly encrypted backups and a restore drill; uptime and backup alerts; checks of the things earlier phases left for prod (ZIP through Caddy, big live files in memory, R2 counters, `pg_trgm`).
- **Out:** email (LOCKED.md "Not now"; Oracle's free Email Delivery is noted for later), Sentry, a staging environment (exactly two environments), a second VM, backups of R2 itself (R2 is the durable copy; LOCKED.md backs up the database only), scaling past one VM, a custom domain (DuckDNS).
- **Picked up from earlier phases (PROGRESS.md "Phase 6" follow-ups):** the worker as its own container (Phase 2); R2 CORS with `storage:setup`, never `storage:setup-test` (Phase 2); re-check R2's free tier (Phase 2); realtime behind Caddy on the same `wss://` site, `WEB_URL` the public address, `NEXT_PUBLIC_REALTIME_URL` at build time (Phase 3); `/collab` behind Caddy and realtime's memory for big files (Phase 4); a long ZIP through Caddy and several at once, `pg_trgm` in prod (Phase 5); the admin CLI inside the worker container (Phase 3).

## How each step is run

Same as before, in learning mode: one branch and one PR per step, built and tested in a scratch copy first (`step-scratch`), explained with whole files, verified with `step-verify`. Steps 3 and 4 are mostly the user clicking in the Oracle, Cloudflare, GitHub and DuckDNS consoles and typing commands on the VM; there the "files" are the runbook and the commands, and Claude never sees or handles a secret (the user pastes them into the server's `.env` themselves). Versions and console screens are checked at the time of each step (`npm view`, image tags, current docs), since cloud consoles change. The full e2e suite passes in CI mode locally before anything is pushed.

Facts on 2026-11-23 (check again in each step):

- **Oracle Always Free (this account):** Arm A1, 1,500 OCPU-hours and 9,000 GB-hours a month (one VM of 2 OCPUs / 12 GB all month); 200 GB of block volume in all (boot volumes included); Object Storage 20 GB (standard, infrequent and archive together) and 50,000 API requests a month; 10 TB outbound a month. An instance whose CPU is under 20% at the 95th percentile for 7 days counts as idle and can be stopped, after an email.
- **Cloudflare R2 free tier:** 10 GB-month of Standard storage, 1 million Class A and 10 million Class B operations a month, no egress charges. The app already stops uploads at 9 GB and warns at 70% / blocks at 90% of the operations (Phases 2–3).
- **GitHub (public repo):** Linux ARM64 runners (`ubuntu-24.04-arm`) and GHCR storage for public images are free.

## Design

### Images (step 1)

- **Three images**, all `linux/arm64`, on `node:24-…-slim` (the exact tag chosen in the step), non-root user, `HEALTHCHECK`:
  - **web:** Next.js with `output: "standalone"`, built inside the image. `NEXT_PUBLIC_REALTIME_URL` is a build argument (`wss://devsbucket.duckdns.org/realtime`): Next bakes `NEXT_PUBLIC_*` in at build time. Server values (`DATABASE_URL`, `BETTER_AUTH_*`, `GITHUB_*`, `S3_*`) come from the environment at run time, so one image works for any `.env`.
  - **realtime:** Node runs its TypeScript directly (as today), with the workspace packages it imports; `pnpm deploy --filter realtime --prod` (or `turbo prune`, decided in the step) gives a folder with only what it needs.
  - **worker:** the same way; it also carries the admin CLI (`src/admin.ts`), a migrate command (`drizzle-orm`'s migrator over `packages/db/drizzle`, no `drizzle-kit` in prod) and `storage:setup`, so everything run by hand in prod runs inside it (`docker compose run --rm worker …`).
- **`GET /api/health`** (web, new): 200 when the app answers and a `select 1` succeeds, 503 otherwise; no data, no auth. Realtime already has `/health`.
- **`docker/compose.prod.yml`:** `postgres` (same `postgres:18.6-alpine`, a named volume, not published), `web`, `realtime`, `worker`, `caddy` (`caddy:2-alpine`, ports 80/443, volumes for its data and config), all `restart: unless-stopped`, memory limits so one container can't starve the rest (roughly web 2 GB, realtime 3 GB, worker 1 GB, postgres 2 GB, caddy 256 MB; tuned in step 7), Docker's log rotation. Images by tag: `ghcr.io/jitesh2git/devsbucket-<app>:${DEVSBUCKET_TAG}`. Env from `/opt/devsbucket/.env` (committed: `docker/.env.prod.example` with placeholders).
- **`docker/Caddyfile`:** one site, `{$DEVSBUCKET_DOMAIN}`: `handle_path /realtime/*` → `realtime:3001` (WebSockets pass through; the events socket and `/collab` both live under it), everything else → `web:3000`; `encode zstd gzip` but not for the ZIP route (already a stream); security headers. Automatic HTTPS with Let's Encrypt (HTTP-01 on port 80). Realtime's `WEB_URL` and Origin check use `https://devsbucket.duckdns.org`.
- **Prod-like locally:** the same Compose file runs on the Mac with `DEVSBUCKET_DOMAIN=localhost` (Caddy's internal certificate), Garage instead of R2 and images built locally, so step 1 is proven before any cloud account is touched.

### Images in CI (step 2)

- `.github/workflows/ci.yml` grows a second job, `images`, that runs only on pushes to `main` after the checks job passes: on `ubuntu-24.04-arm`, `docker/build-push-action` builds the three images (layer cache in GitHub Actions' cache) and pushes them to GHCR tagged with the commit SHA and `main`. `permissions: packages: write` for that job only; the checks job stays read-only.
- The three GHCR packages are made public once (a click in GitHub), so the VM pulls without credentials.
- `NEXT_PUBLIC_REALTIME_URL` comes from a repository variable (not a secret: it's public in the page).

### The server (step 3, by hand, runbook `docs/runbook.md`)

- **VM:** Ampere A1, 2 OCPUs / 12 GB, Ubuntu 24.04 (aarch64), in the home region, boot volume 100 GB (of the 200 GB), the user's SSH public key only. If Oracle says "out of capacity", try again later or another availability domain (common for A1).
- **Network:** the subnet's security list allows 22 (the user's IP only, if practical), 80 and 443; Oracle's Ubuntu images also carry their own `iptables` rules that reject everything but SSH, so 80 and 443 are added there too and saved (`netfilter-persistent`). The public IP is kept across stops and restarts.
- **Base setup:** Docker Engine with the Compose plugin (from Docker's apt repository), a `deploy` user in the `docker` group, 4 GB of swap, `unattended-upgrades`, SSH with keys only, `/opt/devsbucket/` holding `compose.yml`, `Caddyfile`, `.env` (mode 600, owned by `deploy`), `deploy.sh` and `backup.sh`.
- **DuckDNS:** the `devsbucket` subdomain pointed at the VM's public IP, plus DuckDNS's cron updater (in case the IP ever changes). The DuckDNS token stays on the server.
- **Idle stops (decision 0020):** not prevented. UptimeRobot (step 7) emails when the site is down; the runbook says how to start the instance again in the console and check it (containers restart by themselves, data is on the boot volume).

### Services and the first deploy (step 4)

- **R2:** a private bucket, an API token limited to that bucket (object read and write), CORS set with `storage:setup` run in the worker container on the server (allowed origin `https://devsbucket.duckdns.org`). Region `auto`. Check how `usage_counters` lines up with Cloudflare's monthly reset.
- **GitHub OAuth:** a second OAuth app for prod, callback `https://devsbucket.duckdns.org/api/auth/callback/github` (LOCKED.md "Environments": its own OAuth app).
- **Secrets:** `BETTER_AUTH_SECRET` (`openssl rand -base64 32` on the server), the Postgres password, R2 keys, GitHub client secret, DuckDNS token: typed into `/opt/devsbucket/.env` by the user on the server, never committed, never in GitHub (GitHub only gets the deploy SSH key in step 5).
- **First deploy by hand:** `deploy.sh <sha>` (written in this step, automated in step 5): pull the images, `docker compose run --rm worker migrate`, `docker compose up -d`, wait for `/api/health`. Then `pnpm admin`'s commands through the worker container: `set-admin` for the user's account, `create-invite`.
- **Smoke test** on the live site: sign up with the invite (email, then link GitHub), upload small and 60 MB files, preview, share with a second account, live edit together, ZIP a folder, notifications live.

### Deploy on merge (step 5)

- **Workflow:** a `deploy` job after `images` in `ci.yml` (so nothing deploys unless the checks passed and the images exist), in a GitHub **environment** `production` holding three secrets: the deploy SSH private key, the host and its `known_hosts` line. Concurrency group `deploy`, never cancelled halfway.
- **Locked-down key:** the deploy key's line in the server's `authorized_keys` has a forced command (`command="/opt/devsbucket/deploy.sh",no-port-forwarding,no-pty`), so the key can only run a deploy with a commit SHA; the script checks that the argument is a 40-character hex SHA.
- **`deploy.sh <sha>`:** lock (one deploy at a time) → back up the database (`backup.sh`, step 6; until then a local `pg_dump` into `/opt/devsbucket/backups/`) → pull the new images → run migrations in a one-off worker container (a failed migration stops here: its transaction rolls back and the old containers keep running) → `up -d` with the new tag → health check (`/api/health` through Caddy and realtime's `/health`, up to ~60 s) → on success, record the SHA in `current` and keep the previous one in `previous`; on failure, `up -d` with the previous tag and exit non-zero (the GitHub job goes red).
- **Migrations and rollback:** rolling back the images doesn't undo a migration, so migrations stay backward-compatible with the previous release (add columns and tables, drop in a later release); a migration that can't be is called out in its PR, and the backup taken just before it is the way back.
- Old images are pruned on the server, keeping the current and previous ones.

### Backups (step 6)

- **What:** `pg_dump --format=custom` of the database, piped through `age` to the backup public key, uploaded to an Oracle Object Storage bucket through its S3-compatible API (a Customer Secret Key). Nightly at 02:30 UTC (before the worker's 03:00 jobs) by a systemd timer on the VM, and before every deploy.
- **Where it runs:** a small `backup` service in the Compose file (Alpine with `postgresql18-client`, `age` and `rclone`), run with `docker compose run --rm backup`. No change to the worker.
- **Keys:** the server only has the `age` public key, so a stolen server can't read old backups; the private key lives in the user's password manager (and is needed for a restore).
- **Keep:** the newest 14 nightly backups plus the pre-deploy ones of the last 7 days; older objects deleted by the script. A few MB each: far inside 20 GB and 50,000 requests a month.
- **Alert:** each successful run pings its Healthchecks.io check; a missing ping after 26 hours emails the user.
- **Restore drill** (runbook, done once in this step and after any change to it): download the newest backup on the VM, decrypt it with the private key (pasted for the drill, then removed), `pg_restore` into a throwaway `devsbucket_restore_check` database in the same Postgres, compare row counts with the live tables, drop it. Prod data stays on the server (LOCKED.md: it only comes to local as an anonymized copy, not built now).

### Monitoring and prod checks (step 7)

- **UptimeRobot** (free): an HTTPS monitor on `/api/health` every 5 minutes, email alerts. Together with Healthchecks.io (step 6), the only outside services added (decision 0020).
- **Measured on the VM, with fixes if needed:** a 1 GB / 1,000-file ZIP through Caddy (no timeout mid-stream) and two at once (CPU, memory, other pages still answering); a 100 MB text file open in the live editor (realtime memory against its limit); memory limits tuned from `docker stats` under that load; R2 operation counters against Cloudflare's dashboard after a day of use; `pg_trgm` present (search works).
- **Runbook additions:** where logs are (`docker compose logs`), restarting one service, the idle-stop restart, rotating each secret (Better Auth secret signs everyone out), what to do when R2 or Object Storage nears its limit.

### Tests

- **Unit / database:** the health route (200, and 503 when the database is down); the migrate command applies pending migrations to a fresh database.
- **E2E:** unchanged (CI keeps testing the app with `next start`); the prod-like local stack of step 1 is exercised by a short smoke script (sign up, upload, open the editor) rather than the whole suite.
- **Deploy:** `deploy.sh` has a dry-run mode and is tested on the VM with a bad tag (health check fails → previous version back) before step 5 is merged.
- **Backups:** the restore drill is the test.

## Steps

Each is one branch and PR. Steps 3 and 4 are mostly by hand; their PRs carry the runbook, the example env file and the scripts.

| #   | Step                         | Branch                 | Main pieces                                                                                                                                                                      | Verify                                                                                                                                                      |
| --- | ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Images and a prod-like stack | `feat/docker-images`   | Dockerfiles for web (standalone), realtime, worker (+ migrate, admin, `storage:setup`), `/api/health`, `docker/compose.prod.yml`, `docker/Caddyfile`, `docker/.env.prod.example` | `docker compose -f docker/compose.prod.yml up` on the Mac with Garage: `https://localhost` signs up, uploads, live-edits through `/realtime`, ZIPs a folder |
| 2   | Images in CI                 | `ci/images`            | `images` job on `ubuntu-24.04-arm` after the checks, push to GHCR with SHA and `main` tags, packages public                                                                      | A merge to `main` publishes three arm64 images; the Mac pulls and runs them in the step-1 stack                                                             |
| 3   | The server                   | `docs/server-setup`    | `docs/runbook.md` (VM, network and `iptables`, Docker, `deploy` user, swap, upgrades, `/opt/devsbucket`, DuckDNS, idle-stop restart)                                             | SSH in with the key; `docker run --rm hello-world` on arm64; `devsbucket.duckdns.org` resolves to the VM; ports 80/443 reach it                             |
| 4   | Services and first deploy    | `chore/first-deploy`   | R2 bucket, token and CORS; prod GitHub OAuth app; server `.env`; `deploy.sh` run by hand; first admin and invite; runbook sections                                               | The live smoke test above passes over HTTPS                                                                                                                 |
| 5   | Deploy on merge              | `ci/deploy`            | `deploy` job in the `production` environment, forced-command SSH key, `deploy.sh` with lock, backup, migrate, health check, rollback, image pruning                              | A small merged change is live in minutes; a deploy of a broken tag rolls back by itself and the job goes red                                                |
| 6   | Backups                      | `feat/backups`         | `backup` service (`pg_dump` → `age` → Object Storage), systemd timer, pre-deploy backup, retention, Healthchecks.io ping, restore drill in the runbook                           | Tonight's backup is in the bucket; a skipped run emails; the restore drill's row counts match                                                               |
| 7   | Monitoring and prod checks   | `chore/prod-checks`    | UptimeRobot on `/api/health`; ZIP, big-file and memory measurements on the VM; memory limits tuned; R2 counters compared; runbook additions                                      | Stopping `web` brings an UptimeRobot email; the measurements and any fixes are noted in PROGRESS.md                                                         |
| 8   | Review                       | `chore/phase-6-review` | CLAUDE.md (prod commands and rules), diagrams 3 and 11 updated, LOCKED.md checked, follow-ups from Phase 6, tag `v0.6.0`                                                         | CI green and deployed; tag on the merge commit                                                                                                              |

## Open questions (to answer during the steps)

- **Step 1:** `pnpm deploy` or `turbo prune` for the realtime and worker images; the Node base image tag; whether web's standalone output needs the workspace packages copied in by hand; how big each image ends up.
- **Step 2:** build time on the ARM runner with the cache; whether the `images` job should also run on PRs (build without push) to catch Dockerfile breakage early.
- **Step 3:** whether Oracle gives A1 capacity in the home region on the first try; whether 22 can be limited to the user's IP (a home IP may change).
- **Step 4:** whether `usage_counters`' month matches Cloudflare's billing month; whether Better Auth needs `trustedOrigins` or cookie settings behind Caddy.
- **Step 5:** health check timing (Next's first request after start); keeping one previous release or more.
- **Step 6:** `rclone` or `aws-cli` for Object Storage's S3 API; whether 14 days is the right history.
- **Step 7:** whether the 1 GB / 1,000-file ZIP caps and realtime's memory fit 12 GB in practice, or need lowering.
