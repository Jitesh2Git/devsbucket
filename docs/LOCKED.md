# DevsBucket rebuild: locked decisions

Locked on 2026-11-11. To change anything here, add a decision note explaining why. Diagrams: `diagrams.md`, 11 Mermaid diagrams to paste into Excalidraw one at a time (More tools → Mermaid to Excalidraw).

## Constraints

- **Budget:** $0 a month, forever. Every free limit has a hard stop in the app plus a warning before it's reached.
- **Build approach:** a new GitHub repo, built from scratch one phase at a time.

## Stack

| Area         | Choice                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting      | Oracle Always Free ARM VM (2 cores, 12 GB RAM, 200 GB disk). Never upgrade the account to Pay As You Go.                                                |
| Runtime      | Docker Compose in both local and prod. Caddy for HTTPS. DuckDNS for the free domain.                                                                    |
| Language     | TypeScript, Node 24 LTS. pnpm + Turborepo monorepo with `apps/web`, `apps/realtime`, `apps/worker`, `packages/db`, `packages/authz`, `packages/shared`. |
| Web          | Next.js App Router, Tailwind v4, shadcn/ui (other UI libraries allowed), TanStack Query, react-hook-form + Zod                                          |
| Auth         | Better Auth: email/password and GitHub login. Sign-ups are invite-only. No email for now, so passwords are reset with an admin command.                 |
| Database     | Postgres 18 in Docker (prod too), Drizzle ORM + drizzle-kit                                                                                             |
| Files        | Cloudflare R2, private bucket, presigned URLs, browser uploads directly                                                                                 |
| Live editing | Yjs + Hocuspocus. Monaco (y-monaco) edits every text file. Tiptap handles rich notes only.                                                              |
| Live events  | WebSockets in `realtime`, triggered by Postgres LISTEN/NOTIFY                                                                                           |
| Jobs         | pg-boss in `worker`                                                                                                                                     |
| Backups      | Nightly encrypted `pg_dump` to Oracle Object Storage                                                                                                    |
| Quality      | Biome, Vitest, Playwright, GitHub Actions                                                                                                               |
| Deploy       | Merging to `main` runs CI, then the server is updated over SSH: backup, migrations, `docker compose up`, health check, rollback if it fails             |
| Not now      | Email, Sentry, end-to-end encrypted Vault (rejected)                                                                                                    |

## Limits

- **Per user:** 1 GB, adjustable per user.
- **Per file:** 100 MB. Files over 50 MB upload in parts.
- **Live editing:** no size limit.
- **R2, whole app:** uploads stop at 9 GB. Operation counters warn at 70% of the free tier and block at 90%.

## Roles

- **Roles:** Owner > Editor > Viewer.
- **Inheritance:** a role on a folder covers everything inside it, and the highest role wins.
- **Ownership:** everything in a folder tree belongs to the tree's owner, and counts against the owner's quota. `createdBy` records who uploaded each item.
- **Viewer:** can view, preview, see live cursors read-only, and download or copy (the owner can turn downloads off).
- **Editor:** can do everything a Viewer can, plus edit, upload, create folders, rename, move, trash, restore, see version history, and share or create share links (the owner can turn sharing off).
- **Owner:** can do everything an Editor can, plus delete forever, transfer ownership and change sharing settings.

## Editing

- **Monaco** edits every text file, with live cursors.
- **Versions** are saved automatically every few minutes and when the last person leaves, or manually with a message.
- **Diff view:** the Monaco diff editor, for any two versions. Tiptap notes are converted to Markdown for the diff.

## Notifications

- **Never sent** to the person who did the action. Each type can be turned off, and any item can be muted. They're deleted after 90 days.
- **Sharing:** shared with you, access changed, access removed (always on), access requested, request approved or denied, ownership transferred.
- **Content** (to the Owner, batched): files added to your folder, file edited (at most once per file per hour), moved to trash or restored, old version restored.
- **System:** storage at 80% and 95%, storage full (always on), trash emptying in 3 days, invite used, and for admins only, R2 at 70% and 90%.

## Activity

Activity is a permanent, per-item log, visible to the Owner and Editors. Every action writes one activity row, and the worker turns those rows into notifications.

- **Content:** created/uploaded, edited (one entry per editing session), version saved, version restored, renamed, moved, copied, trashed/restored, deleted forever (logged on the parent), downloaded.
- **Sharing:** shared, access changed or removed, share link created or disabled, first open via a share link, access requested/approved/denied, ownership transferred, settings changed.
- **Not logged here:** opening a file goes to the `ItemView` table, which powers the Recent view. Sign-ins are covered by Better Auth sessions.

## Environments

There are two: **local** (your Mac) and **prod** (the Oracle VM). Each has its own database, storage, secrets and GitHub OAuth app. Only the code and the migrations are shared. Prod secrets never leave the server, and prod data only comes to local as an anonymized copy.
