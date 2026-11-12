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
- [x] 10. **Better Auth:** Drizzle adapter, route handler, email/password, invite-only sign-up, sign-in and sign-up pages
  - [x] 10a. Branch `feat/auth`, `better-auth@1.7.21` (exact) and `@devsbucket/db` in web, `apps/web/.env.example`
  - [x] 10b. `lib/auth.ts` + `/api/auth/[...all]` route handler (`/api/auth/ok` returns `{"ok":true}`)
  - [x] 10c. Invite-only sign-up (check and use up the invite on the server, in a transaction)
  - Note: the invite is claimed in `databaseHooks.user.create.before` with a conditional `UPDATE … WHERE used_at IS NULL AND expires_at > now()`, through `getCurrentAdapter()` so it runs in the sign-up transaction. Tested in a scratch copy: missing, unknown, expired and wrong-email codes are rejected; a failed sign-up doesn't burn the invite; 5 simultaneous sign-ups on one code → exactly 1 user.
  - Gotcha: the Drizzle adapter's `transaction` option defaults to `false`, which silently turns Better Auth's transaction into a no-op. Set `transaction: true`.
  - Gotcha: Better Auth's adapter only accepts models it knows (`Model "invite" not found in schema`). A tiny inline plugin (`invitesModel`) declares the `invites` fields; Drizzle still owns the real schema.
  - Gotcha: `create.after` hooks run after the commit, so they can't veto anything. Used only to fill `used_by`.
  - Note: Better Auth's typed APIs reject unknown body fields, so `inviteCode` can't be passed through `authClient.signUp.email()` or `auth.api.signUpEmail()` without a type error. This is decided in 10d.
  - [x] 10d. Form foundation: react-hook-form + resolvers, shadcn card/field/input/label, Biome override for `components/ui`, shared auth schemas, auth client
  - Note: react-hook-form 7.91.0, @hookform/resolvers 7.0.5. With no version given, pnpm's release-age guard picked the newest versions older than a day, so no exclusions were needed. `apps/web` needs no direct `zod` dependency; schemas and types come from `@devsbucket/shared/auth`.
  - Gotcha: run `pnpm lint:fix` after every `shadcn add`. shadcn writes its own style (no semicolons, unsorted imports), which fails `pnpm lint` until Biome reformats it. The `components/ui/**` override turns off Biome's _linter_ there (shadcn's `field.tsx` breaks three rules) but keeps formatting.
  - [x] 10e. Invite-first sign-up: invite code in an httpOnly cookie (hook reads it), invite step + account form
  - Note: a server action that sets a cookie re-renders the current page by itself, so the page switches from the invite form to the account form with no `router.refresh()`. The page reads `cookies()`, so with Cache Components it sits inside `<Suspense>` (build shows `/sign-up` as ◐ Partial Prerender). `findOpenInvite` lives in `packages/db/src/invites.ts`; web has no direct `drizzle-orm` dependency.
  - [x] 10f. Sign-in page, `proxy.ts` sends signed-in users away from `/sign-in` and `/sign-up`, show/hide toggle on password fields
  - Note: Next.js 16 renamed middleware to Proxy (`apps/web/proxy.ts`, named export `proxy`). It checks the real session with `auth.api.getSession`, limited by `matcher` to the two auth pages. A cookie-only check (`getSessionCookie`) was rejected here: a stale or revoked session cookie would bounce the user from `/sign-in` forever.
  - Gotcha: don't centre things inside a shadcn `Button` with `-translate-y-1/2`. The button's press effect (`active:translate-y-px`) uses the same Tailwind 4 variable (`--tw-translate-y`) and replaces it, so the button jumps on click. `PasswordInput` uses `top-0.5` instead (32px input, 28px button).
  - Decision: the invite code travels in an httpOnly cookie (`devsbucket.invite`, 1 hour), set by a server action after the code is checked. Same mechanism will carry it through the GitHub round trip in step 11. Header/body were rejected: Better Auth's typed client won't accept an extra body field, and OAuth has no body.
  - Note: pnpm 12 won't install versions less than a day old (`minimumReleaseAge`). better-auth 1.7.21 was a few hours old, so pnpm added exact-version entries to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. They're harmless and can be removed once that version is old enough.
  - Note: the `@esbuild-kit/*` deprecation warning comes from drizzle-kit (also a dependency of better-auth). Nothing to fix.
  - Gotcha (zsh): quote `workspace:*` specs, e.g. `pnpm add "@devsbucket/db@workspace:*"`. Unquoted, zsh treats `*` as a wildcard and fails with "no matches found".
  - Gotcha: create-next-app's `apps/web/.gitignore` ignores `.env*` with no exception, which also hid `.env.example`; added `!.env.example`.
- [x] 11. **GitHub login:** OAuth app for localhost (the user creates it and enters the secrets), login button
  - [x] 11a. Branch `feat/github-login`, GitHub OAuth app (local), `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `apps/web/.env.local` and `.env.example`
  - Note: GitHub's 2026 OAuth App form has a "Redirect URIs" list (up to 10, optional wildcard matching: keep it off) and "Expire user access tokens" (kept on; the `accounts` table already stores refresh tokens and expiry).
  - [x] 11b. Wire GitHub into Better Auth + buttons (sign-up needs the invite cookie; sign-in of an existing user doesn't)
  - Note: GitHub sign-up goes through the same `create.before` invite hook (Better Auth creates OAuth users in a transaction too). `disableImplicitSignUp: true` means only the sign-up page (`requestSignUp: true`) can create accounts; from sign-in, an unknown GitHub user gets `?error=signup_disabled`. Tested for real: a GitHub sign-up used its invite, stored the avatar, `email_verified = true`, and a refresh token (token expiry is on).
  - Gotcha: Better Auth only redirects OAuth failures to `errorCallbackURL?error=<code>` when the thrown `APIError` has a `code`, so the invite errors carry `INVITE_REQUIRED` / `INVITE_INVALID`. `oauth-error.tsx` maps known codes to text and never shows `error_description` (it comes from the URL, so anyone could craft it).
  - Decision: no automatic linking of GitHub to an existing password account with the same email (`account_not_linked`). Password accounts are unverified (no email), so auto-linking would allow pre-account takeover. Connecting GitHub to an existing account is an explicit action on the profile page (step 12, `authClient.linkSocial`).
  - Gotcha: `new Date()` while rendering a Server Component under Cache Components → "unstable value" dev error (red "1 issue" badge on `/sign-up` since 10e). `findOpenInvite` now uses SQL `now()`.
  - Note: lucide-react 1.x has no brand icons; the GitHub mark is inline SVG from Octicons (MIT) with `aria-hidden`.
- [x] 12. **Profile page:** username and avatar (GitHub avatar for now; uploading an avatar waits for storage in phase 2)
  - [x] 12a. Branch `feat/profile`, header user menu (avatar or initials, name, email, sign out) or a "Sign in" link
  - Note: the header's `UserMenu` reads the session server-side inside `<Suspense>`, so every page is now ◐ Partial Prerender (static shell, user menu streamed per request). Only `name`, `email` and `image` are passed to the client dropdown.
  - [x] 12a+. Busy state on the auth forms: while any submit or the GitHub redirect is in flight, every control is disabled and the clicked button shows a spinner
  - Gotcha (Next.js 16 + Cache Components): pages you navigate away from aren't unmounted. They're hidden with React `<Activity>` and keep their state and DOM (up to 3 routes). After signing in, the sign-in form stayed in the page, disabled, with the password still in its input, and sign-out's `router.push("/sign-in")` showed it again exactly like that. Fixes, both from the Next.js "Preserving UI state" guide: sign-out does a full page load (`window.location.href`) so no client state outlives the session; the sign-in/up forms reset themselves in a `useLayoutEffect` cleanup (runs when Activity hides them) after a successful submit.
  - [x] 12b. `/profile` page (signed-in only), set a username
  - Note: `/profile` is guarded twice: `proxy.ts` redirects signed-out visitors early (matcher now includes `/profile`), and the page checks the session itself (Proxy is only an optimistic check). The `updateUsername` server action re-checks the session and re-validates; the user id always comes from the session. A taken username is detected from Postgres error `23505` (unique violation, on Drizzle's `error.cause`), not a lookup-then-write, so two people can't race for one name. `UserAvatar` is shared by the header and the profile page.
  - [x] 12c. Connect GitHub to an existing account (`linkSocial`), list connected sign-in methods, disconnect GitHub
  - Note: `account.accountLinking.allowDifferentEmails: true` (the explicit Connect flow while signed in; implicit linking by email from the sign-in page stays off) and `updateUserInfoOnLink: true` (copies GitHub name and avatar on link, never the email). `unlinkAccount` takes the **`accounts` row id** (from `listUserAccounts`), not a provider id, needs a fresh session (signed in within a day), and refuses to remove the last sign-in method.
  - Bug fixed: "Continue with GitHub" on `/sign-up` for a GitHub account that already has a DevsBucket account just signs in (correct), but the invite cookie was only cleared when a user was _created_, so it lingered for an hour and `/sign-up` skipped straight to the account form. The cookie is now cleared in `databaseHooks.session.create.after`, i.e. on any sign-in.
  - [x] 12d. Passwords on the profile: **Set password** for GitHub-only accounts, **Change password** (with "Sign out my other devices") for accounts that have one
  - Decision: no email change and no "forgot password" (both need sending email; resets stay an admin command per LOCKED.md). GitHub never shares the user's GitHub password, so a GitHub-only account has no DevsBucket password until the user sets one.
  - Note: `auth.api.setPassword` is server-only (no public URL), so it's called from a server action; it refuses with `PASSWORD_ALREADY_SET` if a password exists. `changePassword` checks the current password (`INVALID_PASSWORD`) and with `revokeOtherSessions` deletes every other session and gives this device a new one. Both use Better Auth's "sensitive session" check, which only re-reads the session from the database (no recent-sign-in rule; that one is only on unlink).
  - Decision 0005 (account linking): GitHub is attached only by GitHub sign-up or **Connect** on the profile. `disableImplicitLinking: true`, because by default "Continue with GitHub" re-linked a verified account after Disconnect. `updateUserInfoOnLink` turned back off (connecting renamed accounts, so two accounts looked identical). Known gap: without email verification, someone with an invite can take another person's email first. That can't take over anything, but it blocks the owner. Mitigated by email-locked invites and the admin command.
  - Gotcha: `shadcn add dialog` asks to overwrite `components/ui/button.tsx` (a dependency). Answer **N**: the only difference is an `import type` line.
- [x] 13. **Tests:** Vitest with a first unit test, Playwright sign-in smoke test
  - [x] 13a. Branch `test/vitest-playwright`, Vitest in `packages/shared`, unit tests for the Zod schemas, `pnpm test` through turbo
  - Note: Vitest 5.1, no config file (it finds `*.test.ts`); tests sit next to the code and import `describe`/`it`/`expect` explicitly. `pnpm test` is unit tests only, cached by turbo. Removed a stray `"rules": { "preset": "recommended" }` (a Biome setting) from the root `package.json`.
  - [x] 13b. Playwright in `apps/web`: sign-up with an invite, sign out, sign in (smoke test)
  - Note: Playwright 1.65 with its own Chromium (`pnpm --filter web exec playwright install chromium`). `pnpm test:e2e` resets a separate `devsbucket_test` database (`pnpm --filter @devsbucket/db db:reset-test`: create if missing, migrate, truncate, add invite `E2E-INVITE`; refuses any name not ending in `_test`) and starts its own server on port 3100 pointed at it. CI mode (`CI=1`): `next build && next start`, settings from the environment instead of `.env.local`.
  - Gotcha: Next.js 16 allows one `next dev` per build folder (lock file `.next/dev/lock`), so the test server couldn't start while `pnpm dev` was running. `next.config.ts` now reads `distDir` from `NEXT_DIST_DIR`, and Playwright sets it to `.next-e2e`.
  - Gotcha: `apps/web` isn't an ES module package, so `import.meta` fails in Playwright's setup files; the DB reset runs as a pnpm script instead.
  - Note: DBeaver shows only the connection's own database by default; tick **Show all databases** (Edit Connection → Main) to see `devsbucket_test`.
- [ ] 14. **CI:** GitHub Actions runs Biome, typecheck, Vitest and Playwright (with a Postgres service), and it goes green
  - [ ] 14a. Branch `ci/github-actions`, `.github/workflows/ci.yml`, first green run on the PR
  - [ ] 14b. Branch protection on `main`: PR required, the CI check must pass
- [ ] 15. **Phase review:** update CLAUDE.md commands, tag `v0.1.0`

## Later phases (summary)

2. **Drive basics:** items tree, direct uploads with quota and R2 guards, browsing with pagination, rename, move, trash, download, previews
3. **Sharing:** authz package and role test grid, permissions, share links, access requests, activity, notifications, realtime events
4. **Live editing:** Monaco + Yjs + Hocuspocus, cursors, versions, diff view, Markdown preview
5. **Notes and extras:** Tiptap notes, Cmd+K search, starred and recent, activity panel, ZIP download
6. **Prod:** Oracle VM, Caddy, DuckDNS, R2, backups, deploy pipeline
