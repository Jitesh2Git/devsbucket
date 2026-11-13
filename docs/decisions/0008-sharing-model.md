# 0008: How sharing works: grants, links, Shared with me

Date: 2026-11-13 · Status: accepted

## Context

Phase 3 adds sharing on top of decision 0002 (three roles, tree ownership, one SQL function that resolves roles). LOCKED.md fixes the roles and what each can do, but not how someone reaches a shared item, what a share link gives, or what a person without access sees. Phase 2 left one question open: how shared items appear next to My Drive, where names are unique per folder (decision 0007).

## Decision

**Resolving a role**

- One SQL function, `item_access(user_id, item_id)`, walks up the parent chain once and returns the role (`owner`, `editor`, `viewer` or none) plus the item's effective settings. Owner if the tree is theirs; otherwise the highest of their grants and their opened, still-active share links on the item or any folder above it.
- `can(access, action)` in `packages/authz` stays a pure function over that result, with a test grid of every role × action × setting.
- Grants only add access: a Viewer grant on a file inside a folder where you're an Editor changes nothing.

**Settings**

- `editors_can_share` and `viewers_can_download` live on items, default on, changed by the Owner only.
- Turned off on a folder, they're off for everything inside it (the most restrictive setting on the chain wins).
- Turning downloads off hides Download and blocks the download route. Previews still send the bytes to the browser (as in Google Drive); the UI says so.

**Sharing with people**

- Only people who already have an account, found by exact email. An unknown email gets "No DevsBucket account uses this email". (Sign-ups are invite-only and there's no email to invite with.)
- Owners and Editors (when `editors_can_share` is on) add, change and remove grants. Owners and Editors see who has access; Viewers see only the owner.
- Anyone can remove their own grant ("Remove from Shared with me").

**Share links**

- One active link per item at most, with a role (Viewer or Editor) and an optional expiry. Disabling or resetting it replaces the row, so old tokens stop working.
- A link only works for **signed-in** users. Opening it records a visit (`share_link_visits`); from then on the role comes from the visit while the link is active, and the item appears in Shared with me. The token never has to travel with later requests.
- The first open is logged as activity.

**What someone without access sees**

- Signed in, item exists, no access: a "You need access" page, without the item's name, with **Request access** (Viewer or Editor and a short message). This reveals that the id exists; ids are UUIDv7 with 62 random bits, so they can't be guessed.
- Signed out: sign in first. A missing or deleted item: 404.

**Shared with me**

- A flat list of the top-most items shared with you (by grant or link), with owner, your role and when it was shared. Opening a folder browses inside it; breadcrumbs start at "Shared with me" and stop at the top-most item you can see.
- No shortcuts in My Drive, so the unique-name rule (0007) never applies to this list.

**Inside someone else's tree**

- Everything an Editor creates or uploads belongs to the tree's owner and counts against the owner's quota (0002). `created_by` records who did it.
- Only the uploader can finish or cancel their own pending upload.
- Moves stay inside one owner's tree, and the Editor needs Editor access on both ends.
- Trash: the Owner's Trash lists everything trashed in their trees, with who trashed it. An Editor's Trash also lists what they trashed in other people's trees while they still have Editor access, so they can restore it. Only the Owner deletes forever.

## Why / alternatives rejected

- **Public links that work without an account:** useful for sending a file to an outsider, but it needs a separate public page and route, rate limits and anonymous storage reads against R2's free tier. Not now; it would get its own note.
- **Passing the link token on every request:** visits are simpler, work for every file inside a linked folder, and still stop the moment the link is disabled or expires.
- **Shortcuts in My Drive:** a new item type, name clashes, and shortcuts that point at deleted or unshared items. The list covers the need; shortcuts can come later.
- **Always 404 for no access (hide that it exists):** makes access requests impossible. Ids aren't guessable, so the page leaks almost nothing.
- **Inviting people by email who have no account:** there's no email to send, and pending grants for strangers' addresses are a privacy and cleanup problem.
- **Postgres RLS:** still not used (0002); `item_access()` is the one place roles are resolved.
