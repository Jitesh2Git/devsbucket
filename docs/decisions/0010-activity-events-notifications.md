# 0010: Activity, live events and notifications

Date: 2026-11-13 · Status: accepted

## Context

LOCKED.md says every action writes one activity row, the worker turns activity into notifications, and live events go over WebSockets from `apps/realtime`, triggered by Postgres LISTEN/NOTIFY. It doesn't say how these pieces connect, how the realtime server knows who is connected, or how "batched" content notifications work.

## Decision

**Activity**

- Every action inserts its `activities` row in the **same transaction** as the change, through one helper (`logActivity(tx, …)`). No activity without the change, and no change without its activity.
- The same transaction queues a pg-boss job (`notify-activity`, sent through the transaction) so the worker turns it into notifications. Nothing is lost if the worker is down; it catches up.
- Phase 3 writes activity for everything that exists so far. The activity panel to read it is Phase 5.

**Live events**

- Postgres `NOTIFY` on one channel, `devsbucket_events`, sent inside the action's transaction (Postgres delivers it on commit, never for a rolled-back change). The payload is small JSON: `{ kind: "folder", folderId }` or `{ kind: "user", userId, type }`. No names or content.
- `apps/realtime` (Node + `ws`) keeps one `LISTEN` connection and routes each event to sockets.
- A socket is authenticated when it opens: realtime forwards the browser's cookie to the web app's Better Auth session endpoint. It never reads the auth tables itself.
- A client subscribes to the folder it's viewing; realtime checks `item_access()` before accepting. A folder event only says "this folder changed": the client refetches through the normal server actions, which check permissions again.
- User events: a new notification, access granted, changed or removed (the page re-checks and leaves if access is gone), Shared with me changed.
- After a reconnect the client refetches everything it shows, since events missed while offline aren't replayed.

**Notifications**

- Created by the worker from activity (sharing and content types) or by scheduled checks (system types). Never sent to the person who acted.
- Before inserting, the worker checks the recipient's preferences and mutes (a mute on a folder covers what's inside). "Access removed" and "storage full" are always on.
- **Batching:** content notifications for the Owner are grouped. If an unread notification of the same type for the same folder and actor exists from the last hour, its count goes up instead of adding a row ("Asha added 5 files to Projects").
- **System alerts** (storage 80% / 95% / full, R2 operations 70% / 90% for admins, trash emptying in 3 days): raised once when a threshold is crossed and remembered in `alert_states`, cleared when usage falls back, so they don't repeat every check.
- Deleted after 90 days by a daily job.

## Why / alternatives rejected

- **Writing activity after the transaction:** a crash in between loses it.
- **A database trigger that writes activity:** hides logic from the app and can't know the actor without session variables.
- **The worker polling the activity table:** works, but needs its own cursor bookkeeping; pg-boss already gives retries and a queue.
- **Server-Sent Events from Next.js instead of `apps/realtime`:** fewer moving parts now, but Phase 4's Hocuspocus needs the realtime server anyway, and LOCKED.md fixes WebSockets.
- **Realtime reading `sessions` and checking cookie signatures itself:** couples it to Better Auth's internals; one HTTP call per connection is cheap.
- **Sending names or content in events:** would bypass the permission check when access changes; events only say what to refetch.
