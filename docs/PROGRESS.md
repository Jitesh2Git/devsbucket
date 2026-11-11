# Progress

Tick a step only after Claude has verified it. Add a note under a step for anything surprising (a bug, a workaround, a version quirk).

## Phase 1: Foundation (current)

**Done when:** `docker compose up` + `pnpm dev` gives a working sign-up (with an invite), login (email or GitHub) and profile page, and CI passes.

- [x] 1. **Repo root:** `git init`, root `.gitignore`, `package.json` (private, `packageManager`), `pnpm-workspace.yaml`, `.nvmrc` (24)
- [x] 2. **GitHub:** create an empty public repo `devsbucket`, add the remote, push the first commit
  - Note: no SSH key on this Mac, so `origin` uses HTTPS (`https://github.com/Jitesh2Git/devsbucket.git`) with the keychain credential.
- [x] 3. **apps/web:** create-next-app (TypeScript, App Router, Tailwind, no ESLint, no git, pnpm), and check that it runs
  - Note: Next.js 16.4.6, React 19.3, Tailwind 4.3, Cache Components on (the default).
  - Note: pnpm had no shim under Node 24 (`spawn pnpm ENOENT`); fixed with `corepack enable pnpm`. Upgraded to pnpm 12.18.0 (`corepack use`).
  - Note: create-next-app writes its own `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `packageManager` into `apps/web`; removed all three. Build-script settings live in the root `pnpm-workspace.yaml` as `allowBuilds` (pnpm 12 name).
- [x] 4. **Turborepo:** add `turbo`, `turbo.json` (dev/build/lint/typecheck/test tasks) and root scripts
  - Note: turbo 2.11.10. Task is named `typecheck` (Turborepo docs call it `check-types`). `lint` and `test` are empty until steps 5 and 13. First step done on a branch + PR (`chore/turborepo`).
- [x] 5. **Biome:** root config, plus lint and format scripts
  - Note: Biome 2.6.6, pinned exactly. Runs once from the root (`biome check .`), not through turbo, as Turborepo's Biome guide recommends; the `lint` turbo task was removed.
  - Note: `linter.rules.recommended` is deprecated in 2.6; use `"preset": "recommended"`. `apps/web/public` is excluded (static assets; starter SVGs failed `noSvgWithoutTitle`).
  - Note: Biome 2.6 also formats Markdown, so the first `lint:fix` reformatted the docs (blank lines, aligned tables; whitespace only).
- [x] 6. **shadcn/ui:** init in `apps/web`, base layout, light/dark theme
  - Note: shadcn 4.23.0, `init -c apps/web -t next -b radix --no-monorepo` → style `radix-nova`, lucide icons. `lib/utils.ts` re-exports `cn` from the `cn` package (replaces clsx + tailwind-merge); `shadcn` is a runtime dependency because `globals.css` imports `shadcn/tailwind.css`.
  - Note: the generated `globals.css` expects the layout font on `--font-sans`; Geist is loaded with `variable: "--font-sans"`.
  - Note: theme via next-themes 0.4.6 (`attribute="class"`, system default); icon toggle switches icons with CSS to avoid hydration mismatches. Our components use arrow functions + default exports; `components/ui/` keeps shadcn's style.
- [x] 7. **Docker Compose (dev):** Postgres 18 (volume + healthcheck) and the S3-compatible storage container (pick SeaweedFS or Garage here), plus `.env.example`
  - Note: picked **Garage** v2.5.0 (decision 0004). Postgres `18.6-alpine`. Both bound to `127.0.0.1` only (5432, 3900), both with healthchecks; `pnpm docker:up` waits until healthy.
  - Note: Postgres 18 images keep data in `/var/lib/postgresql/18/docker`, so the volume mounts at `/var/lib/postgresql` (not `/data` as in older guides).
  - Note: Garage's `--single-node --default-bucket` creates the key and bucket on first start. Key format is strict: RPC secret and secret key are 64 hex chars, key ID is `GK` + 24 hex. Secrets live in `docker/.env` (ignored); `docker/.env.example` and `garage.toml` are committed.
- [x] 8. **Shared TypeScript config** and `packages/shared` (Zod)
  - Note: `@devsbucket/typescript-config` (`base.json`, `nextjs.json`) and `@devsbucket/shared` (Zod 4.6.7). Shared is a Just-in-Time package: `exports: { "./*": "./src/*.ts" }`, no build step, no barrel file; Turbopack compiles it in web, and Node 24 type stripping can run it directly (hence `erasableSyntaxOnly`: no enums or namespaces).
  - Note: web `typecheck` is `next typegen && tsc --noEmit`. Without typegen, a clean checkout (CI) fails on generated types like `LayoutProps`.
  - Note: staying on TypeScript 5.9 although 7.0 is out; revisit once Next.js supports it.
  - Gotcha (Docker): switching branches deleted and recreated `docker/garage/garage.toml`, which broke Garage's single-file bind mount (healthcheck failed). Fix: `docker compose -f docker/compose.dev.yml up -d --wait --force-recreate garage`.
- [x] 9. **packages/db:** Drizzle + drizzle-kit, connection, first migration (Better Auth tables, user profile fields, Invite), seed script
  - Note: drizzle-orm 0.45.4 + drizzle-kit 0.31.11 (stable; 1.0 is still RC), node-postgres. Migration `0000_init` creates `users`, `sessions`, `accounts`, `verifications`, `invites`.
  - Note: the Better Auth tables are based on `auth generate` output for better-auth 1.7.21 with `usePlural: true` and `generateId: "uuid"`; sign-up and sign-in were tested against this schema. The Better Auth CLI is now the `auth` package (`@better-auth/cli` is deprecated).
  - Note: ids are `uuid` with `uuidv7()` (Postgres 18), timestamps are `timestamptz`, columns are snake_case via `casing: "snake_case"` (must match in `client.ts` and `drizzle.config.ts`).
  - Note: drizzle-kit needs esbuild's install script, approved with `allowBuilds: esbuild: true` (pnpm 12 fails interactive installs until you decide).
  - Gotcha: when `drizzle-kit migrate` fails with no message, check `DATABASE_URL` first (here it still had the `change-me` placeholder).
  - Note: added `.vscode/settings.json` so the editor formats with Biome (it had been formatting with Prettier at 80 columns).
- [ ] 10. **Better Auth:** Drizzle adapter, route handler, email/password, invite-only sign-up, sign-in and sign-up pages
- [ ] 11. **GitHub login:** OAuth app for localhost (the user creates it and enters the secrets), login button
- [ ] 12. **Profile page:** username and avatar (GitHub avatar for now; uploading an avatar waits for storage in phase 2)
- [ ] 13. **Tests:** Vitest with a first unit test, Playwright sign-in smoke test
- [ ] 14. **CI:** GitHub Actions runs Biome, typecheck, Vitest and Playwright (with a Postgres service), and it goes green
- [ ] 15. **Phase review:** update CLAUDE.md commands, tag `v0.1.0`

## Later phases (summary)

2. **Drive basics:** items tree, direct uploads with quota and R2 guards, browsing with pagination, rename, move, trash, download, previews
3. **Sharing:** authz package and role test grid, permissions, share links, access requests, activity, notifications, realtime events
4. **Live editing:** Monaco + Yjs + Hocuspocus, cursors, versions, diff view, Markdown preview
5. **Notes and extras:** Tiptap notes, Cmd+K search, starred and recent, activity panel, ZIP download
6. **Prod:** Oracle VM, Caddy, DuckDNS, R2, backups, deploy pipeline
