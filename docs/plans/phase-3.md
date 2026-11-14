# Phase 3 plan: Sharing

Planned 2026-11-13, at the end of Phase 2 (`v0.2.0`). Checklist and progress: `docs/PROGRESS.md`. Decisions made for this phase: `docs/decisions/0008-sharing-model.md`, `0009-ownership-transfer.md`, `0010-activity-events-notifications.md`, `0011-admin-page.md` (added during step 1).

## Goal

Owners and Editors share items with other users as Editor or Viewer, roles inherit down folder trees, share links work for signed-in users, people without access can ask for it, and ownership can be transferred. Every action writes activity; the worker turns it into notifications (including the storage, R2 and trash ones Phase 2 only prepared), and `apps/realtime` pushes them and folder changes live. An admin command handles password resets and accounts. CI covers it.

**Done when:** with `pnpm docker:up` + `pnpm dev`, two users in two browsers can share a folder, browse it from Shared with me with the right role (buttons and server both enforce it), open a share link, request and grant access, transfer ownership, and see notifications and folder changes appear without reloading. The role grid and `item_access()` have tests, the e2e tests cover two-user flows, and CI is green.

## Scope

- **In:** LOCKED.md "Roles", "Notifications" (the types that exist so far) and "Activity" (writing it), plus the admin command carried over from Phase 1.
- **Out (Phase 4):** live editing, versions, "file edited" and "old version restored" notifications, live cursors. **Out (Phase 5):** the activity panel (reading activity), making a copy, Recent (`ItemView`), stars, search.
- **Out (not planned):** public links without an account, shortcuts in My Drive (decision 0008).

## How each step is run

Same as before (learning mode): one branch and one PR per step, researched and tested in a scratch copy first (`step-scratch`), explained for the user to build, then verified (`step-verify`). Versions are checked with `npm view` at the time of the step. Each step adds its own e2e test, like Phase 2.

## Design

### Data model

New columns on `items`:

| Column                 | Type                  | Notes                                                                   |
| ---------------------- | --------------------- | ----------------------------------------------------------------------- |
| `editors_can_share`    | boolean, default true | Owner only. Off on a folder → off for everything inside (decision 0008) |
| `viewers_can_download` | boolean, default true | Same inheritance                                                        |

New tables (all ids `uuid` with `uuidv7()`, timestamps with time zone, text + check instead of enums):

| Table                 | Columns                                                                                                                                                                      | Keys and indexes                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `item_permissions`    | `id`, `item_id` (cascade), `user_id` (cascade), `role` (`editor`, `viewer`), `granted_by` (set null), `created_at`, `updated_at`                                             | unique `(item_id, user_id)`; `(user_id)` for Shared with me               |
| `share_links`         | `id`, `item_id` (cascade), `token` (unique, 32 random bytes, base64url), `role`, `expires_at` null, `disabled_at` null, `created_by` (set null), `created_at`                | unique `(item_id) where disabled_at is null` (one active link per item)   |
| `share_link_visits`   | `link_id` (cascade), `user_id` (cascade), `first_opened_at`                                                                                                                  | primary key `(link_id, user_id)`; `(user_id)`                             |
| `access_requests`     | `id`, `item_id` (cascade), `requester_id` (cascade), `role`, `message` null, `status` (`pending`, `approved`, `denied`), `decided_by` (set null), `decided_at`, `created_at` | unique `(item_id, requester_id) where status = 'pending'`                 |
| `ownership_transfers` | `id`, `item_id` (cascade), `from_user_id`, `to_user_id` (cascade), `status` (`pending`, `accepted`, `declined`, `cancelled`), `created_at`, `decided_at`                     | unique `(item_id) where status = 'pending'`                               |
| `activities`          | `id`, `item_id` (cascade), `actor_id` (set null), `action` (text + check), `metadata` jsonb, `created_at`                                                                    | `(item_id, created_at desc)`                                              |
| `notifications`       | `id`, `recipient_id` (cascade), `actor_id` (set null), `type`, `item_id` (cascade, null for system), `payload` jsonb (`count` for batches), `read_at`, `created_at`          | `(recipient_id, created_at desc)`; `(recipient_id) where read_at is null` |
| `notification_prefs`  | `user_id` (cascade), `type`, `enabled`                                                                                                                                       | primary key `(user_id, type)`; no row = on                                |
| `item_mutes`          | `user_id` (cascade), `item_id` (cascade), `created_at`                                                                                                                       | primary key `(user_id, item_id)`                                          |
| `alert_states`        | `key` (text, e.g. `storage-80:<user id>`, `r2-ops-70:2026-11`), `raised_at`                                                                                                  | primary key `key`                                                         |

Each table arrives in the step that first needs it. Activity is permanent per item (LOCKED.md), so it goes when the item is deleted forever; "deleted forever" itself is logged on the parent.

### Resolving a role: `item_access()` (decisions 0002, 0008)

A SQL function in a custom migration (`drizzle-kit generate --custom`), so web, worker and realtime all resolve roles the same way:

```sql
item_access(p_user uuid, p_item uuid)
  returns table (role text, editors_can_share boolean, viewers_can_download boolean, trashed boolean)
```

1. Walk up from `p_item` with a recursive CTE (depth guard like `getBreadcrumbs`).
2. `owner` if `items.owner_id = p_user`.
3. Else the highest of: `item_permissions` rows for `p_user` on the chain, and `share_link_visits` for `p_user` whose link is on the chain, not disabled and not expired.
4. Settings: `bool_and` of each setting over the chain (any folder above turning it off wins).
5. No row returned → the item doesn't exist.

`@devsbucket/db/access` wraps it: `getAccess(userId, itemId)` and `getAccessMany` for listings. Tests run against the test database (see Tests).

### `packages/authz` v1

- `can(access, action)` where `access = { role, editorsCanShare, viewersCanDownload }`; still pure, no database.
- Actions: Phase 2's nine, plus `share` (people and links), `change_settings`, `transfer`, `view_activity`, `request_access` (only when there's no role).
- The grid: every action × (owner, editor, viewer, none) × settings on/off, typed `Record<Action, …>` as before. Rules from LOCKED.md: Viewer = view, download (unless off); Editor = Viewer + upload, create_folder, rename, move, trash, restore, view_activity, share (unless off); Owner = all, including delete_forever, change_settings, transfer.
- The top level of My Drive has no row; it's always `owner` for its user.
- Callers (`resolveFolder`, `resolveFile`, every server action and route) switch from `can(user, action, { ownerId })` to `getAccess` + `can`. Pages: no role → "You need access" page (0008); missing → 404; role but not allowed → 403 for actions, hidden buttons in the UI.

### Activity (decision 0010)

- `logActivity(tx, { itemId, actorId, action, metadata })` in `@devsbucket/db/activity`, called inside the transaction of every action, and the same transaction sends a `notify-activity` pg-boss job (pg-boss 12's `send` takes a `db` option that runs its SQL on our transaction; confirm in step 4).
- Phase 3 actions: `created`, `uploaded`, `renamed`, `moved` (from/to folder), `trashed`, `restored`, `deleted_forever` (on the parent, with the name), `downloaded`, `shared`, `access_changed`, `access_removed`, `link_created`, `link_disabled`, `link_changed` (role or expiry, added in step 7), `link_opened` (first open), `access_requested`, `access_approved`, `access_denied`, `ownership_offered`, `ownership_transferred`, `settings_changed`. Phase 4 adds `edited`, `version_saved`, `version_restored`.
- Nothing reads activity in the UI yet except the worker (panel: Phase 5).

### Sharing UI

- **Share dialog** (row menu and folder header, for those who may share): add people by exact email + role; list of people with access, each with a role menu or "Remove"; inherited access shown as "Editor, from <folder>" (changed on that folder). Owner only: the "Editors can share" switch. ("Viewers can download" was dropped in step 5, decision 0012: migration 0006 removes the column and recreates `item_access()` without it.)
- **Link section** in the same dialog: off / on, role, optional expiry, copy, disable, reset (new token).
- **`/s/[token]`**: signed out → sign in, then back; valid → record the visit (first time: activity) → redirect to the item; disabled or expired → "This link no longer works".
- **Shared with me** (`/drive/shared`, sidebar): top-most shared items, owner, your role, date; "Remove from Shared with me" removes your own grant or visit. Cursor pagination like folders.
- **Browsing someone else's folder:** same `FolderView`, breadcrumbs from Shared with me, row menus show only allowed actions, a role badge in the header. Uploads say whose quota they use when it's full ("Not enough space in <owner>'s drive").
- **"You need access"** page with Request access (role + message); the Share dialog lists pending requests with Approve (pick role) / Deny.
- **Transfer** (owner, in the Share dialog): pick someone who has access → confirm (warns when the item will leave its folder) → recipient sees a banner on the item and a notification: Accept / Decline.
- **Trash:** Owner's Trash shows "Trashed by"; Editors also see what they trashed in others' trees (0008).

### Realtime (`apps/realtime`, decision 0010)

- Node 24 + `ws`, no build (like the worker), port **3001** locally (3101 for e2e), started by `pnpm dev`. Later (Phase 4) Hocuspocus joins the same app.
- On connect: forward the `Cookie` header to the web app's `/api/auth/get-session`; no session → close. Verify in step 10 that the cookie reaches `localhost:3001` (cookies ignore ports) and what changes behind Caddy in Phase 6.
- One `pg` connection with `LISTEN devsbucket_events`; sockets indexed by user and by subscribed folder.
- Messages from the client: `subscribe { folderId }` (checked with `item_access`), `unsubscribe`. Messages to the client: `folder-changed`, `notification`, `access-changed`, `shared-changed`.
- Client: a `RealtimeProvider` in the drive layout (one socket per tab, reconnect with backoff, refetch on reconnect), turning events into TanStack Query invalidations. Folder events come from the item actions via `pg_notify` in their transaction.

### Notifications (LOCKED.md, decision 0010)

| Group   | Types (Phase 3)                                                                                                                           | Recipient                                                               | Source                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| Sharing | shared with you, access changed, access removed (always on), access requested, request approved / denied, ownership offered / transferred | the person affected; requests go to the Owner and Editors who may share | activity                |
| Content | files added to your folder, moved to trash, restored (batched per folder, actor and hour)                                                 | the Owner                                                               | activity                |
| System  | storage 80% / 95%, storage full (always on), trash emptying in 3 days, invite used; admins: R2 operations 70% / 90%                       | the user, or every admin                                                | worker schedules + hook |

- Worker queues: `notify-activity` (per activity row), `check-alerts` (every 15 minutes: storage per user, R2 operations this month; `alert_states` stops repeats), `trash-warning` (daily: trash roots 27 days old, one notification per owner), `cleanup-notifications` (daily: older than 90 days). "Invite used" comes from the sign-up hook. The 70% operations log line in `checkUploadLimits` becomes the admin alert.
- UI: a bell in the drive header with the unread count (live), a popover with the latest 20 and "Mark all as read", `/notifications` (paginated), clicking one opens the item. Settings: a Notifications section in `/profile` (one switch per type, always-on ones shown disabled) and "Mute notifications" in the item menu.

### Admin command

`pnpm admin <command>` (LOCKED.md: no email, so passwords are reset by an admin): `reset-password <email>` (prints a one-time random password and revokes sessions), `set-admin <email> [--off]`, `set-quota <email> <size>`, `create-invite [--email]`, `remove-user <email>` (deletes their trees forever through the existing cleanup path so storage and quota stay right, then the account; asks for confirmation). It lives in `apps/worker` (step 1).

### Admin page (step 1b, decision 0011)

`/admin` for users with `is_admin`, signed in normally: Usage, Invites (create, list, revoke) and Users (reset password, set quota, make/remove admin, sign out everywhere, remove user), checked by `canAdmin()` in `packages/authz` on the page and in every server action. Shares its code with `pnpm admin`.

### Tests

- **Unit:** the authz grid (roles × actions × settings), notification batching and recipient rules (pure functions in `packages/shared` or the worker), share link token and expiry helpers.
- **Database:** `item_access()`, Shared with me and the transfer transaction need Postgres. A `test:db` Vitest run in `packages/db` against `devsbucket_test` (refuses other names, like `db:reset-test`), run in CI after the reset and before e2e. Decided in step 2.
- **E2E:** two users with two browser contexts (`browser.newContext()`): share as Viewer (no upload button, server refuses), as Editor (upload counts against the owner), inherited role, link open, request → approve, transfer → accept, notification appears without reload, folder change appears live.

## Steps

Each is one branch and PR. Each step logs activity and sends events for what it adds once steps 4 and 10 exist.

| #   | Step                     | Branch                                          | Main pieces                                                                                                                         | Verify                                                                                                        |
| --- | ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Admin command            | `feat/admin-cli`                                | `pnpm admin` with reset-password, set-admin, set-quota, create-invite, remove-user                                                  | Reset → old password fails, new one works, sessions gone; remove-user leaves no rows, objects or quota behind |
| 1b  | Admin page               | `feat/admin-page`                               | `/admin`, `canAdmin()`, Usage, Invites, Users, Admin link in the account menu                                                       | Member gets 404; every user action works; can't lock yourself out; removed user's header updates              |
| 2   | Grants + `item_access()` | `feat/permissions-schema`                       | `item_permissions`, item settings columns, custom migration with the function, `getAccess`, `test:db` in CI                         | Migration SQL read; owner / grant / inherited / highest wins / setting off above / missing item tests         |
| 3   | authz v1                 | `feat/authz-roles`                              | role-based `can()` + grid, every caller switched, uploader-only complete/cancel, editor moves and trash, "You need access" and 403  | Grid passes; a grant made by SQL lets a Viewer open but not rename; removing a check fails a test             |
| 4   | Activity log             | `feat/activity`                                 | `activities`, `logActivity` in every existing action, `notify-activity` sent in the transaction (worker handler is a no-op for now) | One row per action with the right actor; a failing action leaves no row                                       |
| 5   | Share with people        | `feat/share-dialog`                             | share/change/remove actions, Share dialog, settings switches, inherited rows                                                        | Editor with sharing off can't share; Viewer can't open the dialog; unknown email message                      |
| 6   | Shared with me           | `feat/shared-with-me`                           | `/drive/shared`, top-most query, breadcrumbs from Shared with me, role-aware menus, owner's quota message, editor's Trash           | Folder shared + file inside shared → listed once; remove yourself; Editor upload charges the owner            |
| 7   | Share links              | `feat/share-links`                              | `share_links`, `share_link_visits`, link section, `/s/[token]`, sign-in round trip                                                  | Open → listed in Shared with me; disable/expire → access gone; reset → old token dead                         |
| 8   | Access requests          | `feat/access-requests`                          | `access_requests`, Request access page, pending list in the dialog, approve/deny                                                    | Request → approve as Viewer → can open; deny; one pending request per person                                  |
| 9   | Ownership transfer       | `feat/ownership-transfer`                       | `ownership_transfers`, offer/accept/decline/cancel, quota move, old owner becomes Editor                                            | Nested folder lands at the recipient's top level; both quotas right; recipient over quota → refused           |
| 10  | Realtime server          | `feat/realtime`                                 | `apps/realtime`, session check, LISTEN, folder subscriptions, `RealtimeProvider`, `pg_notify` in item actions, turbo + CI wiring    | Upload in one browser appears in the other; no cookie → closed; access removed → the other page leaves        |
| 11  | Notifications            | `feat/notifications`                            | `notifications`, worker `notify-activity` handler with batching, bell + popover + page, live count, 90-day cleanup                  | Share → bell updates without reload; actor gets nothing; 5 uploads → one "added 5 files"                      |
| 12  | Preferences and mutes    | `feat/notification-settings`                    | `notification_prefs`, `item_mutes`, profile section, mute in item menu                                                              | Type off → none created; muted folder covers its files; always-on types can't be turned off                   |
| 13  | System notifications     | `feat/system-notifications`                     | `alert_states`, `check-alerts`, `trash-warning`, invite-used hook, admin R2 alerts                                                  | 80% once, not again until it drops; trash at 27 days warns once; only admins get R2 alerts                    |
| 14  | Tests + review           | `test/sharing-e2e`, then `chore/phase-3-review` | two-user e2e flows, CLAUDE.md (realtime commands, ports), LOCKED.md check, tag `v0.3.0`                                             | CI green; tag on the merge commit                                                                             |

## Open questions (to answer during the steps)

Answered during the steps (details in `docs/PROGRESS.md`):

- Step 1: `pnpm admin` lives in `apps/worker` (`src/admin.ts`, it has the env and the storage cleanup); passwords are hashed with `better-auth/crypto`'s `hashPassword`.
- Step 2: `item_access()` is plain SQL (`LANGUAGE sql STABLE`), called with `db.execute(sql\`…\`)` (`@devsbucket/db/access`); `test:db`and the e2e reset share`prepareTestDatabase`, and CI runs `test:db` before e2e.
- Step 4: pg-boss 12's `send(…, { db: fromDrizzle(tx, sql) })` runs inside the Drizzle transaction (a database test proves commit and rollback).
- Step 6: the Shared with me query uses the `item_permissions(user_id)` index; no new index.
- Step 10: the cookie reaches `localhost:3001` (cookies ignore ports); realtime checks the `Origin` header (403) and the session (401); Playwright starts web, realtime and worker as three `webServer` entries.

Changed while building (each recorded in PROGRESS.md): "Viewers can download" dropped (decision 0012, step 5); share links can change role and expiry in place (`link_changed`, step 7); notifications are a sidebar link with a live count and a `/drive/notifications` page instead of a header bell and popover (step 11); Shared with me and notifications are capped (200, 100) instead of paginated; one review branch instead of two (step 14).

Asked before the steps:

- **Step 1:** where `pnpm admin` lives (a package script in `packages/db`, `apps/worker`, or a small `apps/admin`), and how to hash a password with Better Auth 1.7 outside the web app.
- **Step 2:** `item_access()` in plain SQL or PL/pgSQL; whether Drizzle can call it cleanly (`db.execute(sql\`…\`)`); how `test:db` shares the reset with e2e in CI.
- **Step 4:** confirm pg-boss 12's `send(…, { db })` runs inside a Drizzle transaction (otherwise: a trigger-free outbox read by the worker).
- **Step 6:** the Shared with me query's speed with many grants (an index on `item_permissions(user_id)` should do; check `explain`).
- **Step 10:** cookie forwarding on `localhost:3001`, the WebSocket origin check, and running two servers in Playwright's `webServer`.
