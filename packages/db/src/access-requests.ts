// Access requests (decision 0008): asking for a role, and approving or
// denying it. Each change logs activity in its own transaction (decision
// 0010). Callers check `can(access, "request_access")` (no role yet) or
// `can(access, "share")` (to decide) first.
import type { GrantRole } from "@devsbucket/shared/sharing";
import { and, asc, eq, sql } from "drizzle-orm";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { accessRequests } from "./schema/access-requests.ts";
import { users } from "./schema/auth.ts";
import { itemPermissions } from "./schema/permissions.ts";

const pending = (itemId: string) =>
  and(eq(accessRequests.itemId, itemId), eq(accessRequests.status, "pending"));

// The user's pending request for the item, or null.
export const getPendingRequest = async (itemId: string, userId: string, tx: Executor = db) => {
  const [request] = await tx
    .select({ id: accessRequests.id, role: accessRequests.role })
    .from(accessRequests)
    .where(and(pending(itemId), eq(accessRequests.requesterId, userId)));
  return request ?? null;
};

// Asks for a role. A second request while one is pending replaces its role
// and message (one pending request per person); only a new one is logged.
export const requestAccess = async ({
  itemId,
  userId,
  role,
  message,
}: {
  itemId: string;
  userId: string;
  role: GrantRole;
  message: string | null;
}) => {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(accessRequests)
      .set({ role, message })
      .where(and(pending(itemId), eq(accessRequests.requesterId, userId)))
      .returning({ id: accessRequests.id });
    if (updated) {
      return "updated" as const;
    }
    // Two at once: the unique pending index lets one in; the other updates.
    const inserted = await tx
      .insert(accessRequests)
      .values({ itemId, requesterId: userId, role, message })
      .onConflictDoNothing()
      .returning({ id: accessRequests.id });
    if (inserted.length === 0) {
      return "updated" as const;
    }
    await logActivity(tx, {
      itemId,
      actorId: userId,
      action: "access_requested",
      metadata: { role },
    });
    return "sent" as const;
  });
};

// An item's pending requests, oldest first, for the Share dialog.
export const listPendingRequests = async (itemId: string, tx: Executor = db) => {
  return tx
    .select({
      id: accessRequests.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: accessRequests.role,
      message: accessRequests.message,
      createdAt: accessRequests.createdAt,
    })
    .from(accessRequests)
    .innerJoin(users, eq(users.id, accessRequests.requesterId))
    .where(pending(itemId))
    .orderBy(asc(accessRequests.createdAt), asc(accessRequests.id));
};

export type PendingRequest = Awaited<ReturnType<typeof listPendingRequests>>[number];

// Approves a pending request on the item: the requester gets `role` (a
// grant, or their grant changed to it), in the same transaction. False if
// it's no longer pending (decided by someone else, or withdrawn).
export const approveRequest = async ({
  itemId,
  requestId,
  role,
  actorId,
}: {
  itemId: string;
  requestId: string;
  role: GrantRole;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .update(accessRequests)
      .set({ status: "approved", decidedBy: actorId, decidedAt: sql`now()` })
      .where(and(eq(accessRequests.id, requestId), pending(itemId)))
      .returning({ userId: accessRequests.requesterId });
    if (!request) {
      return false;
    }
    await tx
      .insert(itemPermissions)
      .values({ itemId, userId: request.userId, role, grantedBy: actorId })
      .onConflictDoUpdate({
        target: [itemPermissions.itemId, itemPermissions.userId],
        set: { role, grantedBy: actorId },
      });
    await logActivity(tx, {
      itemId,
      actorId,
      action: "access_approved",
      metadata: { userId: request.userId, role },
    });
    return true;
  });
};

// Denies a pending request. They may ask again later.
export const denyRequest = async ({
  itemId,
  requestId,
  actorId,
}: {
  itemId: string;
  requestId: string;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .update(accessRequests)
      .set({ status: "denied", decidedBy: actorId, decidedAt: sql`now()` })
      .where(and(eq(accessRequests.id, requestId), pending(itemId)))
      .returning({ userId: accessRequests.requesterId });
    if (!request) {
      return false;
    }
    await logActivity(tx, {
      itemId,
      actorId,
      action: "access_denied",
      metadata: { userId: request.userId },
    });
    return true;
  });
};
