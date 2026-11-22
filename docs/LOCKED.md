# DevsBucket rebuild: locked decisions

Locked on 2026-11-11. To change anything here, add a decision note explaining why. Diagrams: `diagrams.md`, 11 Mermaid diagrams to paste into Excalidraw one at a time (More tools → Mermaid to Excalidraw).

## Constraints

- **Budget:** $0 a month, forever. Every free limit has a hard stop in the app plus a warning before it's reached.
- **Build approach:** a new GitHub repo, built from scratch one phase at a time.

## Stack

| Area         | Choice                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting      | Oracle Always Free ARM VM (2 cores, 12 GB RAM, 200 GB disk). Never upgrade the account to Pay As You Go.                                                                                    |
| Runtime      | Docker Compose in both local and prod. Caddy for HTTPS. DuckDNS for the free domain.                                                                                                        |
| Language     | TypeScript, Node 24 LTS. pnpm + Turborepo monorepo with `apps/web`, `apps/realtime`, `apps/worker`, `packages/db`, `packages/authz`, `packages/shared`, `packages/storage` (decision 0006). |
| Web          | Next.js App Router, Tailwind v4, shadcn/ui (other UI libraries allowed), TanStack Query, react-hook-form + Zod                                                                              |
| Auth         | Better Auth: email/password and GitHub login. Sign-ups are invite-only. No email for now, so an admin resets passwords (decision 0011). GitHub linking rules: see decision 0005.            |
| Database     | Postgres 18 in Docker (prod too), Drizzle ORM + drizzle-kit                                                                                                                                 |
| Files        | Cloudflare R2, private bucket, presigned URLs, browser uploads directly. Local dev uses Garage (S3-compatible) in Docker; see decision 0004.                                                |
| Live editing | Yjs + Hocuspocus. Monaco (y-monaco) edits every text file. No Tiptap: Markdown files with a live preview are the notes (decision 0017).                                                     |
| Live events  | WebSockets in `realtime`, triggered by Postgres LISTEN/NOTIFY                                                                                                                               |
| Jobs         | pg-boss in `worker`                                                                                                                                                                         |
| Backups      | Nightly encrypted `pg_dump` to Oracle Object Storage                                                                                                                                        |
| Quality      | Biome, Vitest, Playwright, GitHub Actions                                                                                                                                                   |
| Deploy       | Merging to `main` runs CI, then the server is updated over SSH: backup, migrations, `docker compose up`, health check, rollback if it fails                                                 |
| Not now      | Email, Sentry, end-to-end encrypted Vault (rejected)                                                                                                                                        |

## Limits

- **Per user:** 1 GB, adjustable per user.
- **Per file:** 100 MB. Files over 50 MB upload in parts.
- **Names:** unique per folder, ignoring case; uploads and restores rename visibly (`notes (1).md`), typed names get an error (decision 0007).
- **Trash:** 30 days, then deleted forever. Trashed files count against the quota until then (decision 0007).
- **Live editing:** no size limit; UTF-8 text files only (decision 0013). Over 10 MB the page warns first and opens the editor only when asked (decision 0014).
- **Versions:** don't count against the quota. The newest 5 automatic versions per file are kept; named and restore versions, and version 1, are kept (decisions 0015, 0016).
- **R2, whole app:** uploads stop at 9 GB. Operation counters warn at 70% of the free tier and block at 90%.

## Roles

- **Roles:** Owner > Editor > Viewer.
- **Inheritance:** a role on a folder covers everything inside it, and the highest role wins.
- **Ownership:** everything in a folder tree belongs to the tree's owner, and counts against the owner's quota. `createdBy` records who uploaded each item.
- **Viewer:** can view, preview, see live cursors read-only, and download or copy (always: decision 0012).
- **Editor:** can do everything a Viewer can, plus edit, upload, create folders, rename, move, trash, restore, see version history, and share or create share links (the owner can turn sharing off).
- **Owner:** can do everything an Editor can, plus delete forever, transfer ownership and change sharing settings.
- **Sharing (decisions 0008, 0019):** with existing accounts, by email or @username. Share links work for signed-in users only. Items shared with you appear in a flat Shared with me list (no shortcuts). Someone signed in without access sees "You need access" and can request it.
- **Transfer (decision 0009):** offered to someone who has access, who accepts; the whole tree moves to the top of their My Drive and the old owner keeps Editor access.

## Editing

- **Monaco** edits every text file (UTF-8, no size limit), with live cursors, on its own file page. Markdown files get a live preview. Editors can create an empty text file (decision 0013).
- **Hocuspocus** runs inside `realtime` on `/collab`; Viewer connections are read-only. The live Yjs state and every version's text live in Postgres; the file's object is rewritten at each version (decision 0013).
- **Versions** are saved automatically when the last person leaves the file (if the text changed), manually with a message, and when an old one is restored (decision 0015).
- **Diff view:** the Monaco diff editor, for any two versions.

## Drive extras (Phase 5, decision 0017)

- **Search:** Cmd+K (Ctrl+K) searches the names of every file and folder you can open (your drive and what's shared with you), not their contents. Typo-tolerant through Postgres `pg_trgm` (a missing or extra letter matches; swapped letters don't).
- **Recent:** the files you opened (editor or preview), newest first, the last 50 you still have access to.
- **Activity panel:** an item's own activity log, for the Owner and Editors (`view_activity`).
- **Make a copy:** files only, any role (decision 0012); the copy goes next to the original if you may upload there, otherwise to the top of your My Drive, and counts against the quota of the drive it lands in. Its versions aren't copied.
- **ZIP download:** a whole folder, any role, streamed by the web app straight from storage, not compressed (CPU on the 2-core VM matters more than bandwidth); up to 1 GB and 1,000 files per ZIP.
- **Not planned:** stars, Tiptap notes, searching file contents.

## Look and feel (decision 0018)

- **Themes:** 14 colour and font styles, listed as data in `@devsbucket/shared/themes`; anyone can pick one and change its accent, greys, fonts, text size, corners, density, surfaces, main button and sidebar on the Themes page.
- **Default:** its own theme, not one of the 14 listed: a blue accent (hue 250) on zinc greys; Sora, IBM Plex Sans for headings, Fira Code for code; 0.75rem corners. Reset on the Themes page brings it back.
- **Per browser:** kept in `localStorage`, like light/dark and grid/table; not on the account.
- **Fonts:** self-hosted with `next/font`, only the default's preloaded.

## Notifications

- **Never sent** to the person who did the action. Each type can be turned off, and any item can be muted. They're deleted after 90 days.
- **Sharing:** shared with you, access changed, access removed (always on), access requested, request approved or denied, ownership offered (decision 0009), ownership transferred.
- **Content** (to the Owner, batched): files added to your folder, moved to trash or restored. Editing sends none (decision 0015).
- **System:** storage at 80% and 95%, storage full (always on), trash emptying in 3 days, invite used, and for admins only, R2 at 70% and 90%.

## Activity

Activity is a permanent, per-item log, visible to the Owner and Editors. Every action writes one activity row in the same transaction, and the worker turns those rows into notifications (decision 0010).

- **Content:** created/uploaded, edited (one entry per person per editing session), version saved (named versions only, decision 0013), version restored, renamed, moved, copied, trashed/restored, deleted forever (logged on the parent), downloaded.
- **Sharing:** shared, access changed or removed, share link created, changed (role or expiry) or disabled, first open via a share link, access requested/approved/denied, ownership offered and transferred, settings changed.
- **Not logged here:** opening a file goes to the `ItemView` table, which powers the Recent view. Sign-ins are covered by Better Auth sessions.

## Environments

There are two: **local** (your Mac) and **prod** (the Oracle VM). Each has its own database, storage, secrets and GitHub OAuth app. Only the code and the migrations are shared. Prod secrets never leave the server, and prod data only comes to local as an anonymized copy.
