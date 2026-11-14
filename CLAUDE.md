# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DevsBucket is a developer-focused file drive. Users can:

- upload files and organize them in folders,
- share with Drive-style roles (Owner, Editor, Viewer),
- edit any text file live with other people, with cursors and git-like version history,
- get realtime notifications.

It's a from-scratch rebuild of an older Next.js + Supabase app; see `docs/decisions/0001-rebuild-and-drop-supabase.md` for why. **The budget is $0, permanently:** every service must be free, with a hard stop in the app before any free limit is reached.

**Source of truth:** `docs/LOCKED.md` holds the stack, limits, roles, notifications, activity and environments. `docs/diagrams.md` holds the architecture diagrams. `docs/plans/phase-N.md` holds the detailed plan for the current phase (design, step table); `docs/PROGRESS.md` tracks the steps. Never change a locked decision silently. Propose it, and once agreed, add a note in `docs/decisions/` and update `LOCKED.md`.

## Working mode: LEARNING MODE (read this first)

The user is building this **by hand to learn**. Unless the user explicitly says "you do it" (or similar) for a specific step:

1. **Explain the next step:** what it is, why it matters, and the exact command or code to write. Keep it short. Check current docs or `--help` for flags and versions rather than assuming them, because tools change. Put "📍 where to run it" above every block of commands (the repo root by default; prefer `--filter <pkg>` over `cd`). Give config files whole, ready to paste, rather than placeholders or fragments to merge.
2. **Wait** for the user to run it or write it themselves.
3. **Verify:** read the files they created and run read-only checks (`git status`, `cat`, `pnpm typecheck`, `pnpm lint`, `docker compose ps`, curl a local URL, and so on). Report clearly whether it passed.
4. **If something is wrong:** explain the problem and the fix, and let the user apply it. Only make the change yourself if they ask.
5. **When it passes:** suggest a conventional commit message (the user commits), tick the step in `docs/PROGRESS.md`, then explain the next step.

**Don't** install packages, scaffold, write app code or commit unless asked. Updating `docs/PROGRESS.md`, and drafting decision notes the user agrees to, is fine.

When the user says "you do it", do that step fully, then go back to learning mode.

Project skills for this loop (`.claude/skills/`, excluded from Biome so it can't reformat their frontmatter): `step-scratch` (build and test the next step in a throwaway copy with its own Postgres, before explaining it) and `step-verify` (verify the user's work, run `.claude/skills/step-verify/check.sh [--e2e]`, tick PROGRESS.md, give the commit, PR title and full PR description).

## Machine (as of 2026-11-12)

- Installed: Node 24.21 LTS, pnpm 12.18.0 (via corepack, pinned by `packageManager` in the root `package.json`), Docker 29.9.3. Docker Desktop must be running for Compose.
- Also installed: DBeaver Community 26.2 (Homebrew), Playwright's Chromium (in `~/Library/Caches/ms-playwright`, installed with `pnpm --filter web exec playwright install chromium`; reinstall after a Playwright upgrade).
- VS Code's GitHub Actions extension can falsely flag `uses:` versions as "not found" when it isn't signed in to GitHub. GitHub's own run is the source of truth.
- Not installed: GitHub CLI (`gh`). The user creates GitHub repos on github.com.

## Conventions

- **Repo layout:** pnpm workspaces + Turborepo monorepo:
  - `apps/web`: Next.js
  - `apps/realtime`: Hocuspocus + WebSocket events
  - `apps/worker`: pg-boss
  - `packages/db`: Drizzle schema and migrations
  - `packages/authz`: `can(user, action, item)`
  - `packages/shared`: Zod schemas and types
  - `packages/storage`: S3 client for Garage/R2, presigned URLs, usage counters (Phase 2, decision 0006)
  - `docker/`: Compose files and Caddyfile
  - `docs/`
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`), one small commit per step.
- **Branches:** never commit to `main` directly (merging to `main` deploys). One branch per step or feature, named `<type>/<short-name>` (e.g. `chore/turborepo`, `feat/auth-invites`). Push it, open a PR on github.com with a conventional-commit title and a Markdown description (What / Changes / How to test / Checklist), and merge with a normal merge commit ("Create a merge commit"). Then `git switch main && git pull`. Branches are kept, locally and on GitHub (the user's choice); don't delete them. `main` is protected by a repository ruleset: changes only through PRs, the CI check "Lint, typecheck and tests" must pass, no force pushes or deletion, nobody bypasses. Tags are not protected; release tags (`v0.1.0`, …) are annotated and pushed after the phase's last PR is merged.
- **React components:** arrow functions with a default export at the bottom (`const ModeToggle = () => { ... };` then `export default ModeToggle;`), imported as `import ModeToggle from "@/components/mode-toggle"`. Pages and layouts follow the same style. Exception: shadcn-generated files in `components/ui/` keep shadcn's own style (named exports), so `shadcn add` can update them cleanly.
- **Internal packages:** scoped `@devsbucket/*`, depended on with `"workspace:*"`. Every tsconfig extends `@devsbucket/typescript-config`. `packages/shared` is Just-in-Time (exports TypeScript source, no build) with one entry per file (`@devsbucket/shared/user`), no barrel files. No enums or namespaces (`erasableSyntaxOnly`); use `as const` objects or Zod enums.
- **Database schema:** plural snake_case table names, camelCase fields in TypeScript (`casing: "snake_case"` maps them), `uuid` ids defaulting to `uuidv7()`, `timestamp({ withTimezone: true })`, `bigint({ mode: "number" })` for byte counts, text + `check` constraints instead of Postgres enums, an explicit snake_case name on `.unique()` for multi-word columns (Drizzle leaves automatic names camelCase). Schema changes always go through a generated, committed migration; never edit an applied migration.
- **Secrets:** never commit `.env*` files. Only `.env.example` files with placeholder values are committed.
- **Environments:** exactly two, local (Docker Compose on the Mac) and prod (Oracle VM). They never share data or secrets.
- **Permissions:** every server action and realtime handler goes through `packages/authz`. Never trust ids from the client without checking the role. Items: get the role from `item_access()` (`getAccess` in `@devsbucket/db/access`), then `can(access, action)`; in the web app, `resolveItem` / `resolveFolder` / `resolveFile` in `apps/web/lib/items.ts` do both and say why not (`missing` → 404, `no-access` → "You need access" on pages and "no longer exists" in actions, `forbidden` → 403 / "You don't have permission to do that."). The admin page uses `canAdmin()`.
- **Activity:** every action on an item writes one row with `logActivity(tx, …)` (`@devsbucket/db/activity`) inside the same transaction as the change; it also queues the `notify-activity` job through that transaction (pg-boss `fromDrizzle`). A new action type goes in `activityActions` and `ActivityMetadata` (`@devsbucket/shared/activity`); one outside the database check needs a migration. Decision 0010.
- **Tests:** unit tests (Vitest) sit next to the code as `*.test.ts` and import `describe`/`it`/`expect` explicitly. End-to-end tests (Playwright) live in `apps/web/e2e/`, find elements by role and label (never CSS classes, and with `exact: true` when one name contains another, like "Move" and "Move to trash"), and only ever use the `devsbucket_test` database and the `devsbucket-test` bucket.
- **CI:** `.github/workflows/ci.yml` runs lint, typecheck, unit and e2e tests (with a Postgres service, and Garage started with `docker run` plus `pnpm storage:setup` for CORS) on every PR and push to `main`. Values in it are CI-only for a throwaway database; real secrets (prod, phase 6) go in GitHub's encrypted Secrets, never in the file.
- **Bugs and ideas:** tracked as GitHub Issues. Progress is tracked in `docs/PROGRESS.md`.

## Commands

Run from the repo root. Turborepo runs each task in every package that has that script, and caches the results.

- `pnpm install`: install all workspace dependencies (never use npm).
- `pnpm dev`: start every app's dev server: web on http://localhost:3000 and the worker (needs `apps/worker/.env`).
- `pnpm build`: production build of every package.
- `pnpm typecheck`: `tsc --noEmit` in every package (web runs `next typegen` first).
- `pnpm lint`: Biome lint + format check + import sorting over the whole repo, without changing files (what CI runs).
- `pnpm lint:fix`: same, and applies safe fixes and formatting. `pnpm format`: formatting only.
- `pnpm test`: unit tests (Vitest, `*.test.ts` next to the code) in every package that has them, through turbo (cached). Nothing needs to be running.
- `pnpm test:db`: database tests (`packages/db/src/*.db.test.ts`, Vitest) against `devsbucket_test` (the URL from `packages/db/.env` + `_test`; created and migrated by `src/test-setup.ts`, refuses any name not ending in `_test`). Needs Docker up. Each test builds its rows in a transaction and rolls it back. CI runs it after the unit tests.
- `pnpm test:e2e`: Playwright end-to-end tests (`apps/web/e2e/`). Needs Docker up and Playwright's Chromium (`pnpm --filter web exec playwright install chromium`). Resets the separate `devsbucket_test` database, empties the `devsbucket-test` bucket (create it once with `pnpm storage:setup-test`) and starts its own server on port 3100 (build folder `.next-e2e`), so it runs next to `pnpm dev` and never touches dev data. `worker.spec.ts` runs the worker's jobs (`pnpm --filter worker job …`) against the same test database and bucket. Locally that server is `next dev`, so expectations wait 10 s instead of Playwright's 5 (`expect.timeout`), and it's best run with `pnpm dev` stopped; CI uses a production build (`next build && next start`), where Better Auth's rate limits apply, so the e2e server sets `AUTH_RATE_LIMIT=off` (`playwright.config.ts`, read in `lib/auth.ts`; never set it anywhere else). To run e2e exactly like CI: `cd apps/web && (set -a; . ./.env.local; set +a; CI=1 pnpm exec playwright test)`.
- `pnpm --filter web <script>`: run a script in one package only.

Local services (Docker Desktop must be running; config in `docker/compose.dev.yml`, secrets in `docker/.env`, copied from `docker/.env.example`):

- `pnpm docker:up`: start Postgres 18 (`127.0.0.1:5432`) and Garage S3 (`127.0.0.1:3900`, region `garage`), waiting until both are healthy.
- `pnpm docker:ps`, `pnpm docker:logs`: status and logs.
- `pnpm docker:down`: stop and remove the containers; data stays in the named volumes (`down -v` would delete it).
- `docker compose -f docker/compose.dev.yml exec postgres psql -U devsbucket -d devsbucket`: a psql shell.

Database (`packages/db`, needs `packages/db/.env` copied from `.env.example` with the password from `docker/.env`):

- `pnpm --filter @devsbucket/db db:generate --name <name>`: write a new SQL migration from schema changes (read it before applying).
- `pnpm db:migrate`: apply pending migrations.
- `pnpm db:seed`: create an open invite if none exists (safe to re-run).
- `pnpm db:studio`: browse the tables in the browser.
- DBeaver (Community, installed with Homebrew): saved connection `DevsBucket (local)` (type Development) to `127.0.0.1:5432` with the credentials from `docker/.env`. Prod (phase 6) will go through an SSH tunnel, as a red Production connection, read-only by default, with a read-only role and no saved password (needs a decision note, since LOCKED.md keeps prod secrets on the server). Direct edits skip the app's rules (invites, ownership, quotas): view freely, change via admin commands.

Storage (`packages/storage`, needs `packages/storage/.env` copied from `.env.example`: the `S3_*` values from `docker/.env` and the `DATABASE_URL` from `packages/db/.env`):

- `pnpm storage:setup`: set the bucket's CORS so the browser can upload straight to Garage (run once per new Garage volume; safe to re-run).
- `pnpm storage:setup-test`: create the e2e tests' own bucket, `<S3_BUCKET>-test` (`devsbucket-test`), and set its CORS. Run once per new Garage volume, like `storage:setup`; CI runs both.
- `pnpm storage:check`: presign, upload, check and delete a throwaway object, including the CORS preflight. Counts real operations in `usage_counters`.

Worker (`apps/worker`, pg-boss; needs `apps/worker/.env` copied from `.env.example`, with the same `DATABASE_URL` and `S3_*` values as `apps/web/.env.local`). Node runs its TypeScript directly (no build). pg-boss keeps its tables in its own `pgboss` schema, which drizzle-kit doesn't manage. Queue names and the connection live in `packages/db/src/jobs.ts`; shared cleanup in `packages/storage/src/cleanup.ts`.

- `pnpm --filter worker dev`: the worker alone (`pnpm dev` starts it with the web app). Schedules: abandoned uploads every 15 minutes, trash older than 30 days daily at 03:00 UTC; failed storage deletes are retried with backoff.
- `pnpm --filter worker job cleanup-uploads` / `job empty-trash`: run one job now. To try them, age rows with SQL first (`update items set trashed_at = now() - interval '31 days' where …`).
- `pnpm admin <command>` (`apps/worker/src/admin.ts`, uses the worker's `.env`, so locally the dev data): `reset-password <email>` (prints a new random password, signs them out everywhere), `set-admin <email> [--off]`, `set-quota <email> <size>` (`5GB`, `500MB`), `create-invite [--email <email>]`, `remove-user <email> [--yes]` (deletes the account and its files forever; asks you to type the email). `pnpm --silent admin …` hides pnpm's error block on failure.

Web app (`apps/web`, needs `apps/web/.env.local` copied from `.env.example`: the same `DATABASE_URL` as `packages/db/.env`, `BETTER_AUTH_SECRET` from `openssl rand -base64 32`, `BETTER_AUTH_URL=http://localhost:3000`, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` from the local GitHub OAuth app, whose callback is `http://localhost:3000/api/auth/callback/github`, and the `S3_*` values from `docker/.env`; restart `pnpm dev` after changing it):

- Sign-up is invite-only: get a code with `pnpm db:seed` (it prints an open invite, or creates one), then open `/sign-up`.
- Admin page `/admin` (decision 0011): for users with `is_admin` (make the first one with `pnpm admin set-admin <email>`); Account menu → Admin. Invites, users (reset password, quota, admin on/off, sign out everywhere, remove) and app usage. Every action checks `canAdmin()` from `@devsbucket/authz/admin`; non-admins get a 404.
- `pnpm --filter web exec shadcn add <component>`: add a shadcn component, then run `pnpm lint:fix` (shadcn's own style fails `pnpm lint` until Biome reformats it).

Single tests:

- One unit test file: `pnpm --filter @devsbucket/shared exec vitest run src/user.test.ts` (add `-t "name"` for one test; drop `run` to watch).
- One database test file: `pnpm test:db src/access.db.test.ts` (same flags).
- One e2e test: `pnpm --filter web test:e2e e2e/auth.spec.ts` (add `-g "name"` to filter by title, `--headed` to watch the browser, `--ui` for Playwright's UI).
- `pnpm --filter @devsbucket/db db:reset-test` resets the test database by hand (needs `DATABASE_URL` ending in `_test` and `E2E_INVITE_CODE`).
