# 0011: Admin page in the app, for admins only

Date: 2026-11-13 · Status: accepted

## Context

Phase 3 step 1 added `pnpm admin` (password resets, admins, quotas, invites, removing accounts). In production that means SSH to the server for everyday things like inviting a friend. The owner wants to manage the app from any browser, signed in like everyone else.

## Decision

- A `/admin` page in the web app (Phase 3 step 1b, before sharing). Admins sign in normally (email/password or GitHub) and use the drive like anyone; the account menu shows an **Admin** link only to them.
- Who is an admin: `users.is_admin`. The first admin is set once per environment with `pnpm admin set-admin <email>`; after that, admins can make others admins on the page. No separate "superuser" account or shared credentials.
- The page has: Usage (app storage and R2 operations against the free tier), Invites (create, optionally for one email; list; revoke unused), Users (reset password, set quota, make/remove admin, sign out everywhere, remove user).
- Every check goes through `canAdmin(user, action, target)` in `packages/authz`: the page (non-admins get a 404), the menu items, and every server action again. An admin can't reset their own password, change their own admin flag, sign themselves out or remove themselves from the page, so they can't lock themselves out.
- The page and `pnpm admin` share the same code (`packages/db/src/users.ts`, `invites.ts`, and `removeUser` in `packages/storage/src/cleanup.ts`), so files, quotas and the storage retry queue behave the same either way. The command stays as the way back in if no admin can sign in.

## Why / alternatives rejected

- **Only the terminal:** works, but needs SSH for routine tasks.
- **A hidden superuser with secret credentials:** a shared secret, outside invites and permission checks, hard to rotate. An `is_admin` flag on a real account gives the same power with normal sign-in and sessions.
- **Two-factor sign-in, required for admins:** built and tested (Better Auth's `twoFactor` plugin), then dropped as more friction than this project needs. Note for later: Better Auth only asks for the code at email sign-in, so GitHub sign-in skips it; requiring 2FA for admins would also need the admin page to ask for a fresh code.
- **Better Auth's `admin` plugin:** adds its own `role` and `banned` columns next to `is_admin`, and its user removal wouldn't delete files from storage or keep quotas right.
