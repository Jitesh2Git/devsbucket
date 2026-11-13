# DevsBucket rebuild: architecture diagrams

Locked on 2026-11-11 (see `LOCKED.md`). Viewer page with copy buttons: https://claude.ai/artifact/CwXsQHd32RWcfxeN51MNJH (private).

**Importing into Excalidraw:** More tools → **Mermaid to Excalidraw**. Paste one block at a time, because Excalidraw takes one diagram per paste.

## 1. Tech stack

```mermaid
flowchart TB
  subgraph infra["Hosting and infrastructure"]
    direction LR
    i0a["Piece"] ~~~ i0b["Choice"]
    i1a["Server"] ~~~ i1b["Oracle Cloud Always Free ARM VM: 2 cores, 12 GB RAM, 200 GB disk, never upgrade the account"]
    i2a["Runtime"] ~~~ i2b["Docker + Docker Compose, dev and prod"]
    i3a["Reverse proxy and HTTPS"] ~~~ i3b["Caddy, automatic Let's Encrypt"]
    i4a["Domain"] ~~~ i4b["DuckDNS free subdomain"]
    i5a["File storage"] ~~~ i5b["Cloudflare R2, private bucket, 10 GB free, hard limits in the app"]
    i6a["Local storage"] ~~~ i6b["S3-compatible container that stands in for R2"]
    i7a["Backups"] ~~~ i7b["Nightly encrypted pg_dump to Oracle Object Storage"]
    i8a["CI/CD"] ~~~ i8b["GitHub Actions: tests, then SSH deploy with docker compose"]
  end
  subgraph app["Application"]
    direction LR
    a0a["Layer"] ~~~ a0b["Choice"]
    a1a["Language"] ~~~ a1b["TypeScript, Node 24 LTS"]
    a2a["Repo"] ~~~ a2b["One GitHub repo: pnpm workspaces + Turborepo, apps web, realtime, worker + shared packages"]
    a3a["Web"] ~~~ a3b["Next.js App Router"]
    a4a["UI"] ~~~ a4b["Tailwind v4 + shadcn/ui, more component libraries if needed"]
    a5a["Client data"] ~~~ a5b["TanStack Query"]
    a6a["Forms and validation"] ~~~ a6b["react-hook-form + Zod"]
    a7a["Auth"] ~~~ a7b["Better Auth: email/password + GitHub login, invite-only sign-ups"]
    a8a["Database"] ~~~ a8b["Postgres 18 in Docker"]
    a9a["ORM and migrations"] ~~~ a9b["Drizzle + drizzle-kit"]
    a10a["Permissions"] ~~~ a10b["Shared authz package: Owner, Editor, Viewer, inherited from folders"]
    a11a["Live editing"] ~~~ a11b["Yjs + Hocuspocus, Monaco for all text files, Tiptap for rich notes"]
    a12a["Versions and diffs"] ~~~ a12b["Automatic and manual snapshots, Monaco diff editor"]
    a13a["Live events"] ~~~ a13b["WebSockets in the realtime server, driven by Postgres LISTEN/NOTIFY"]
    a14a["Background jobs"] ~~~ a14b["pg-boss worker"]
    a15a["Lint and format"] ~~~ a15b["Biome"]
    a16a["Tests"] ~~~ a16b["Vitest + Playwright"]
  end
  infra ~~~ app
```

## 2. Roles and what they can do

```mermaid
flowchart LR
  h0["Action"] ~~~ h1["Viewer"] ~~~ h2["Editor"] ~~~ h3["Owner"]
  r1["View, preview, see live cursors"] ~~~ r1v["✓"] ~~~ r1e["✓"] ~~~ r1o["✓"]
  r2["Download or make a copy"] ~~~ r2v["✓ unless owner turns off"] ~~~ r2e["✓"] ~~~ r2o["✓"]
  r3["Edit content, upload, create folders, rename, move"] ~~~ r3v["—"] ~~~ r3e["✓"] ~~~ r3o["✓"]
  r4["Move to trash, restore, view version history"] ~~~ r4v["—"] ~~~ r4e["✓"] ~~~ r4o["✓"]
  r5["Share, change access, create share links"] ~~~ r5v["—"] ~~~ r5e["✓ unless owner turns off"] ~~~ r5o["✓"]
  r6["Delete forever, transfer ownership, sharing settings"] ~~~ r6v["—"] ~~~ r6e["—"] ~~~ r6o["✓"]
```

## 3. Production system

```mermaid
flowchart LR
  user["User browser"]
  dns["DuckDNS: devsbucket.duckdns.org"]
  gh["GitHub: OAuth login + Actions CI/CD"]
  subgraph vm["Oracle Always Free ARM VM: Docker Compose"]
    caddy["Caddy: HTTPS + reverse proxy"]
    web["web: Next.js, server actions, Better Auth, authz"]
    rt["realtime: Hocuspocus + WebSocket events"]
    worker["worker: pg-boss jobs"]
    pg[("Postgres 18 on Docker volume")]
  end
  r2[("Cloudflare R2: private bucket, user files")]
  oos[("Oracle Object Storage: encrypted DB backups")]
  user -->|"resolve domain"| dns
  user -->|"HTTPS"| caddy
  user -->|"WSS"| caddy
  caddy --> web
  caddy --> rt
  web --> pg
  rt --> pg
  worker --> pg
  pg -.->|"LISTEN/NOTIFY events"| rt
  web -->|"create presigned URLs"| r2
  user -->|"upload/download with presigned URL"| r2
  rt -->|"save file content + versions"| r2
  worker -->|"cleanup, zip, purge trash"| r2
  worker -->|"nightly pg_dump"| oos
  web -->|"GitHub login"| gh
  gh -->|"SSH deploy"| caddy
```

## 4. Local dev environment

```mermaid
flowchart LR
  dev["Browser on your Mac: localhost"]
  next["web: next dev"]
  subgraph compose["docker compose: dev"]
    pg[("Postgres 18 + seed data")]
    s3[("S3-compatible storage, stands in for R2")]
    rt["realtime: Hocuspocus + events"]
    worker["worker: pg-boss"]
  end
  dev --> next
  dev -->|"WS"| rt
  dev -->|"presigned URLs"| s3
  next --> pg
  next --> s3
  rt --> pg
  rt --> s3
  worker --> pg
  worker --> s3
  pg -.->|"NOTIFY"| rt
```

## 5. Monorepo structure

```mermaid
flowchart TD
  repo["devsbucket: one GitHub repo"]
  repo --> apps["apps/"]
  repo --> pkgs["packages/"]
  repo --> dock["docker/: compose dev + prod, Caddyfile"]
  repo --> docs["docs/: stack, decisions, diagrams"]
  apps --> web["web: Next.js"]
  apps --> rt["realtime: Hocuspocus + events"]
  apps --> worker["worker: pg-boss jobs"]
  pkgs --> db["db: Drizzle schema + migrations"]
  pkgs --> authz["authz: roles + can()"]
  pkgs --> shared["shared: Zod schemas + types"]
  web -.-> db
  web -.-> authz
  web -.-> shared
  rt -.-> db
  rt -.-> authz
  worker -.-> db
```

## 6. Data model

The User, Session and Account tables come from Better Auth. The User table has extra fields added.
Value sets used below:

- `Item.type`: folder, file, note
- `Item.status`: pending, ready
- `Item.trashedAt` is set on a trashed item and everything inside it; `trashRoot` marks the one the user trashed (decision 0007). Total stored bytes is `sum(User.storageUsed)`, not a counter.
- `Item.editorsCanShare` arrives with sharing in Phase 3; off on a folder means off for everything inside (decision 0008). There's no download setting: Viewers can always download (decision 0012).
- `ShareLink`: one active link per item; `ShareLinkVisit` records who opened it, and gives them the link's role while it's active (decision 0008).
- `OwnershipTransfer.status`: pending, accepted, declined, cancelled (decision 0009). `AlertState` remembers raised system alerts so they don't repeat (decision 0010).
- `role`: editor, viewer
- `AccessRequest.status`: pending, approved, denied

```mermaid
classDiagram
  class User {
    +id
    +name
    +email
    +username
    +image
    +storageUsed
    +storageQuota
    +isAdmin
    +createdAt
  }
  class Session {
    +id
    +userId
    +token
    +expiresAt
  }
  class Account {
    +id
    +userId
    +providerId
    +accountId
    +passwordHash
  }
  class Invite {
    +id
    +code
    +email
    +createdBy
    +usedBy
    +expiresAt
  }
  class Item {
    +id
    +ownerId
    +parentId
    +createdBy
    +type
    +name
    +mimeType
    +size
    +storageKey
    +status
    +uploadId
    +editorsCanShare
    +createdAt
    +updatedAt
    +trashedAt
    +trashedBy
    +trashRoot
  }
  class ItemPermission {
    +id
    +itemId
    +userId
    +role
    +grantedBy
    +createdAt
  }
  class ShareLink {
    +id
    +itemId
    +token
    +role
    +expiresAt
    +disabledAt
    +createdBy
  }
  class ShareLinkVisit {
    +linkId
    +userId
    +firstOpenedAt
  }
  class OwnershipTransfer {
    +id
    +itemId
    +fromUserId
    +toUserId
    +status
    +createdAt
    +decidedAt
  }
  class AlertState {
    +key
    +raisedAt
  }
  class AccessRequest {
    +id
    +itemId
    +requesterId
    +role
    +message
    +status
    +decidedBy
    +decidedAt
    +createdAt
  }
  class ItemVersion {
    +id
    +itemId
    +storageKey
    +size
    +message
    +isAuto
    +createdBy
    +createdAt
  }
  class CollabState {
    +itemId
    +ydoc
    +updatedAt
  }
  class ItemView {
    +userId
    +itemId
    +lastOpenedAt
  }
  class Notification {
    +id
    +recipientId
    +actorId
    +type
    +itemId
    +payload
    +readAt
    +createdAt
  }
  class NotificationPref {
    +userId
    +type
    +enabled
  }
  class ItemMute {
    +userId
    +itemId
  }
  class Activity {
    +id
    +itemId
    +actorId
    +action
    +metadata
    +createdAt
  }
  class Star {
    +userId
    +itemId
  }
  class UsageCounter {
    +month
    +classAOps
    +classBOps
  }
  User "1" --> "*" Session
  User "1" --> "*" Account
  User "1" --> "*" Invite : creates
  User "1" --> "*" Item : owns
  Item "1" --> "*" Item : parent of
  Item "1" --> "*" ItemPermission
  User "1" --> "*" ItemPermission : granted
  Item "1" --> "*" ShareLink
  ShareLink "1" --> "*" ShareLinkVisit
  User "1" --> "*" ShareLinkVisit : opened
  Item "1" --> "*" OwnershipTransfer
  Item "1" --> "*" AccessRequest
  User "1" --> "*" AccessRequest : requests
  Item "1" --> "*" ItemVersion
  Item "1" --> "0..1" CollabState
  User "1" --> "*" ItemView : recent
  Item "1" --> "*" ItemView
  User "1" --> "*" Notification : receives
  User "1" --> "*" NotificationPref
  User "1" --> "*" ItemMute
  Item "1" --> "*" Activity
  User "1" --> "*" Star
  Item "1" --> "*" Star
```

## 7. Permission check (used by web and realtime)

One SQL function, `item_access()`, does the loading and resolving (decisions 0002, 0008); `can()` decides the last step.

```mermaid
flowchart TD
  req["Request: action on item"] --> s{"Valid session?"}
  s -->|"no"| d401["Deny: 401"]
  s -->|"yes"| load["Load item + parent chain with a recursive query"]
  load --> exists{"Item exists?"}
  exists -->|"no"| d404["Deny: 404"]
  exists -->|"yes"| own{"User owns the tree?"}
  own -->|"yes"| rOwner["Role = Owner"]
  own -->|"no"| grants["Collect grants, and share links the user opened that are still active, on item and every parent"]
  grants --> any{"Any?"}
  any -->|"yes"| rBest["Role = highest: Editor beats Viewer"]
  any -->|"no"| need["'You need access' page: request access, name hidden"]
  rOwner --> allow{"Role allows the action and item settings?"}
  rBest --> allow
  allow -->|"yes"| ok["Allow + write activity log"]
  allow -->|"no"| d403["Deny: 403"]
```

## 8. Upload

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant W as web
  participant DB as Postgres
  participant R2 as Cloudflare R2
  participant RT as realtime
  B->>W: requestUpload with parentId, name, size, mime
  W->>DB: check session, Editor or Owner on parent, quota, R2 limits
  alt not allowed
    W-->>B: error: no permission or quota full
  else allowed
    W->>DB: insert item as pending, reserve quota
    W-->>B: presigned PUT URL, expires in 10 min
    B->>R2: PUT file directly, multipart if over 50 MB
    B->>W: completeUpload with itemId
    W->>R2: HEAD object, verify size
    W->>DB: mark ready, update usage counters, write activity
    DB-->>RT: NOTIFY item created
    RT-->>B: event, folder list updates for everyone viewing
  end
```

## 9. Live editing (Monaco or Tiptap)

```mermaid
sequenceDiagram
  autonumber
  participant A as Browser A
  participant C as Browser B
  participant RT as realtime: Hocuspocus
  participant DB as Postgres
  participant R2 as Cloudflare R2
  A->>RT: connect WSS with session token and itemId
  RT->>DB: verify session, resolve role
  alt Viewer
    RT-->>A: read-only connection
  else Editor or Owner
    RT-->>A: read-write connection
  end
  RT->>DB: load collab state
  opt first time this file is opened
    RT->>R2: fetch file text, build Yjs doc
  end
  RT-->>A: sync document
  C->>RT: connect, same checks
  A->>RT: edits + cursor position
  RT-->>C: broadcast edits + named cursor
  loop debounced while editing
    RT->>DB: store collab state
  end
  loop every few minutes and when last person leaves
    RT->>R2: write file content + version snapshot
    RT->>DB: insert version, update size, write activity
  end
```

## 10. Sharing and notifications

```mermaid
sequenceDiagram
  autonumber
  participant S as Owner or Editor
  participant W as web
  participant DB as Postgres
  participant RT as realtime
  participant R as Recipient browser
  S->>W: share itemId with email as Editor or Viewer
  W->>DB: check sharer is Owner, or Editor with editorsCanShare
  W->>DB: upsert permission, insert activity + notification
  DB-->>RT: NOTIFY recipient channel
  RT-->>R: push notification, Shared with me updates
  R->>W: open item
  W->>DB: resolve role through parent chain
  W-->>R: page rendered for that role
```

## 11. Deploy pipeline

```mermaid
flowchart LR
  push["git push to main"] --> ci["GitHub Actions: Biome, typecheck, Vitest, Playwright"]
  ci -->|"fail"| stop["Stop: nothing deployed"]
  ci -->|"pass"| ssh["SSH into Oracle VM"]
  ssh --> pull["git pull"]
  pull --> build["docker compose build"]
  build --> mig["back up DB, run Drizzle migrations"]
  mig --> up["docker compose up -d"]
  up --> health{"Health check OK?"}
  health -->|"yes"| done["Live"]
  health -->|"no"| back["Roll back to previous images"]
```
