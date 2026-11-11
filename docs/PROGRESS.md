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
- [ ] 4. **Turborepo:** add `turbo`, `turbo.json` (dev/build/lint/typecheck/test tasks) and root scripts
- [ ] 5. **Biome:** root config, plus lint and format scripts
- [ ] 6. **shadcn/ui:** init in `apps/web`, base layout, light/dark theme
- [ ] 7. **Docker Compose (dev):** Postgres 18 (volume + healthcheck) and the S3-compatible storage container (pick SeaweedFS or Garage here), plus `.env.example`
- [ ] 8. **Shared TypeScript config** and `packages/shared` (Zod)
- [ ] 9. **packages/db:** Drizzle + drizzle-kit, connection, first migration (Better Auth tables, user profile fields, Invite), seed script
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
