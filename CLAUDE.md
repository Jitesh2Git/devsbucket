# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DevsBucket is a developer-focused file drive. Users can:
- upload files and organize them in folders,
- share with Drive-style roles (Owner, Editor, Viewer),
- edit any text file live with other people, with cursors and git-like version history,
- get realtime notifications.

It's a from-scratch rebuild of an older Next.js + Supabase app; see `docs/decisions/0001-rebuild-and-drop-supabase.md` for why. **The budget is $0, permanently:** every service must be free, with a hard stop in the app before any free limit is reached.

**Source of truth:** `docs/LOCKED.md` holds the stack, limits, roles, notifications, activity and environments. `docs/diagrams.md` holds the architecture diagrams. Never change a locked decision silently. Propose it, and once agreed, add a note in `docs/decisions/` and update `LOCKED.md`.

## Working mode: LEARNING MODE (read this first)

The user is building this **by hand to learn**. Unless the user explicitly says "you do it" (or similar) for a specific step:

1. **Explain the next step:** what it is, why it matters, and the exact command or code to write. Keep it short. Check current docs or `--help` for flags and versions rather than assuming them, because tools change.
2. **Wait** for the user to run it or write it themselves.
3. **Verify:** read the files they created and run read-only checks (`git status`, `cat`, `pnpm typecheck`, `pnpm lint`, `docker compose ps`, curl a local URL, and so on). Report clearly whether it passed.
4. **If something is wrong:** explain the problem and the fix, and let the user apply it. Only make the change yourself if they ask.
5. **When it passes:** suggest a conventional commit message (the user commits), tick the step in `docs/PROGRESS.md`, then explain the next step.

**Don't** install packages, scaffold, write app code or commit unless asked. Updating `docs/PROGRESS.md`, and drafting decision notes the user agrees to, is fine.

When the user says "you do it", do that step fully, then go back to learning mode.

## Machine (as of 2026-11-11)
- Installed: Node 24.21 LTS, pnpm 12.18.0 (via corepack, pinned by `packageManager` in the root `package.json`), Docker 29.9.3. Docker Desktop must be running for Compose.
- Not installed: GitHub CLI (`gh`). The user creates GitHub repos on github.com.

## Conventions
- **Repo layout:** pnpm workspaces + Turborepo monorepo:
  - `apps/web`: Next.js
  - `apps/realtime`: Hocuspocus + WebSocket events
  - `apps/worker`: pg-boss
  - `packages/db`: Drizzle schema and migrations
  - `packages/authz`: `can(user, action, item)`
  - `packages/shared`: Zod schemas and types
  - `docker/`: Compose files and Caddyfile
  - `docs/`
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`), one small commit per step.
- **Branches:** never commit to `main` directly (merging to `main` deploys). One branch per step or feature, named `<type>/<short-name>` (e.g. `chore/turborepo`, `feat/auth-invites`). Push it, open a PR on github.com, and merge with "Squash and merge" using a conventional-commit PR title. Then `git switch main && git pull` and delete the local branch (`git branch -D`, since squash merges aren't seen as merged). From Phase 1 step 14, `main` gets branch protection: PR required, CI must pass.
- **Secrets:** never commit `.env*` files. Only `.env.example` files with placeholder values are committed.
- **Environments:** exactly two, local (Docker Compose on the Mac) and prod (Oracle VM). They never share data or secrets.
- **Permissions:** every server action and realtime handler goes through `packages/authz`. Never trust ids from the client without checking the role.
- **Bugs and ideas:** tracked as GitHub Issues. Progress is tracked in `docs/PROGRESS.md`.

## Commands
Run from the repo root. Turborepo runs each task in every package that has that script, and caches the results.
- `pnpm install`: install all workspace dependencies (never use npm).
- `pnpm dev`: start every app's dev server (web on http://localhost:3000).
- `pnpm build`: production build of every package.
- `pnpm typecheck`: `tsc --noEmit` in every package.
- `pnpm lint`, `pnpm test`: wired into turbo, but empty until Biome (step 5) and Vitest (step 13).
- `pnpm --filter web <script>`: run a script in one package only.

Still to add as they're set up: how to run a single test, `docker compose -f docker/compose.dev.yml up -d`, and the db migrate/seed commands.
