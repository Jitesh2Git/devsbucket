# 0020: Production setup

Date: 2026-11-23 · Status: accepted

## Context

LOCKED.md fixes the prod stack (Oracle Always Free ARM VM, Docker Compose, Caddy, DuckDNS, R2, nightly encrypted `pg_dump` to Oracle Object Storage, deploy over SSH on merge to `main` with backup, migrations, health check and rollback) but not how images are built, what happens when Oracle stops an idle free VM, or how anyone finds out something broke. While planning Phase 6 (`docs/plans/phase-6.md`) the user checked their own account's Always Free allowances and chose the rest.

## Decision

- **VM size:** 2 OCPUs and 12 GB, as LOCKED.md says. This account's Arm allowance is 1,500 OCPU-hours and 9,000 GB-hours a month (one such VM all month), less than the 4 / 24 the public docs list, so there's no bigger free option.
- **Images:** built by GitHub Actions on the free `ubuntu-24.04-arm` runner after CI passes on `main`, pushed to GitHub's container registry (GHCR) as public images tagged with the commit SHA. The VM only pulls; a rollback is the previous SHA. Not built on the VM.
- **Idle stops:** Oracle may stop an Always Free instance whose CPU is under 20% at the 95th percentile for 7 days. We don't fake load to prevent it: an uptime monitor emails the user, and the runbook says how to start the VM again (data and containers come back with it).
- **Alerts:** UptimeRobot (free) checks `/api/health` every 5 minutes; Healthchecks.io (free) expects a ping from every nightly backup and emails when one is missing. These are the only outside services added.
- **Backups:** `pg_dump` encrypted with `age` to a public key on the server (the private key stays in the user's password manager), uploaded to Oracle Object Storage through its S3-compatible API, nightly and before every deploy, the newest 14 nightly kept. The restore drill runs on the VM into a throwaway database, so prod data doesn't leave the server.
- **Deploy access:** GitHub holds only an SSH key whose `authorized_keys` line forces `deploy.sh`; all app secrets stay in `/opt/devsbucket/.env` on the server.

## Why / alternatives rejected

- **4 OCPUs / 24 GB:** the public docs' figure, but not this account's allowance; going over it isn't free.
- **Building on the VM:** no registry needed, but every deploy compiles Next.js on the 2-core server while it serves, a rollback means building the old commit again, and a failed build leaves the server half-changed.
- **Keeping the VM busy:** avoids the stop, but burns CPU all day that users would otherwise get and works against the free tier's intent; a stop is rare, announced by email and quick to undo.
- **GitHub Actions as the monitor:** no new accounts, but scheduled runs can be late, GitHub disables them after 60 days without commits, and it can't notice a backup that didn't run.
- **gpg with a passphrase on the server:** simpler, but whoever gets the server gets every backup too; `age` with only the public key there avoids that.
- **Oracle's own Monitoring and Notifications:** free, but they watch the VM from inside Oracle, so a stopped VM or a broken Caddy can look fine; an outside HTTPS check sees what users see.
