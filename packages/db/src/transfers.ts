// Ownership transfers (decision 0009): offer, cancel, decline and accept.
// Accepting moves the whole tree to the recipient in one transaction. Each
// function takes an optional executor: inside a transaction, its own
// transaction becomes a savepoint (the database tests use that).
import { nextAvailableName } from "@devsbucket/shared/item";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { takenNames } from "./items.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { ownershipTransfers } from "./schema/ownership-transfers.ts";
import { itemPermissions } from "./schema/permissions.ts";
import { releaseStorage, reserveStorage } from "./usage.ts";

const fromUsers = alias(users, "from_users");
const toUsers = alias(users, "to_users");

const pendingOn = (itemId: string) =>
  and(eq(ownershipTransfers.itemId, itemId), eq(ownershipTransfers.status, "pending"));

// The item's pending offer, with both people, or null.
export const getPendingTransfer = async (itemId: string, tx: Executor = db) => {
  const [transfer] = await tx
    .select({
      id: ownershipTransfers.id,
      toUserId: ownershipTransfers.toUserId,
      toName: toUsers.name,
      fromName: fromUsers.name,
    })
    .from(ownershipTransfers)
    .innerJoin(toUsers, eq(toUsers.id, ownershipTransfers.toUserId))
    .innerJoin(fromUsers, eq(fromUsers.id, ownershipTransfers.fromUserId))
    .where(pendingOn(itemId));
  return transfer ?? null;
};

// Offers made to `userId` that are still pending, newest first.
export const listOffersTo = async (userId: string, tx: Executor = db) => {
  return tx
    .select({
      id: ownershipTransfers.id,
      itemId: items.id,
      name: items.name,
      type: items.type,
      fromName: fromUsers.name,
      createdAt: ownershipTransfers.createdAt,
    })
    .from(ownershipTransfers)
    .innerJoin(items, eq(items.id, ownershipTransfers.itemId))
    .innerJoin(fromUsers, eq(fromUsers.id, ownershipTransfers.fromUserId))
    .where(and(eq(ownershipTransfers.toUserId, userId), eq(ownershipTransfers.status, "pending")))
    .orderBy(sql`${ownershipTransfers.createdAt} desc`);
};

export type TransferOffer = Awaited<ReturnType<typeof listOffersTo>>[number];

// The owner offers the item to someone (the caller checks they own it and
// that the recipient has access). False if an offer is already pending.
export const offerTransfer = async (
  { itemId, fromUserId, toUserId }: { itemId: string; fromUserId: string; toUserId: string },
  tx: Executor = db,
) => {
  return tx.transaction(async (t) => {
    const inserted = await t
      .insert(ownershipTransfers)
      .values({ itemId, fromUserId, toUserId })
      .onConflictDoNothing()
      .returning({ id: ownershipTransfers.id });
    if (inserted.length === 0) {
      return false;
    }
    await logActivity(t, {
      itemId,
      actorId: fromUserId,
      action: "ownership_offered",
      metadata: { toUserId },
    });
    return true;
  });
};

// The owner withdraws the pending offer. False if there was none.
export const cancelTransfer = async (itemId: string, tx: Executor = db) => {
  const cancelled = await tx
    .update(ownershipTransfers)
    .set({ status: "cancelled", decidedAt: sql`now()` })
    .where(pendingOn(itemId))
    .returning({ id: ownershipTransfers.id });
  return cancelled.length > 0;
};

// The recipient says no. False if it isn't a pending offer to them.
export const declineTransfer = async (
  { transferId, userId }: { transferId: string; userId: string },
  tx: Executor = db,
) => {
  const declined = await tx
    .update(ownershipTransfers)
    .set({ status: "declined", decidedAt: sql`now()` })
    .where(
      and(
        eq(ownershipTransfers.id, transferId),
        eq(ownershipTransfers.toUserId, userId),
        eq(ownershipTransfers.status, "pending"),
      ),
    )
    .returning({ id: ownershipTransfers.id });
  return declined.length > 0;
};

export type AcceptResult =
  | { ok: true; itemId: string; name: string }
  | {
      ok: false;
      reason: "gone" | "upload" | "trashed" | "nested-offer";
    }
  | { ok: false; reason: "quota"; used: number; quota: number };

// The recipient accepts. In one transaction (decision 0009): their quota
// takes the subtree's bytes (or it's refused, and the offer stays); the
// item and everything inside it become theirs; the item moves to the top
// of their My Drive under the next free name; the bytes leave the old
// owner's quota; the old owner gets Editor on it; the recipient's own
// grants inside it, now pointless, go. A pending upload, something in the
// trash, or another pending offer inside it blocks the transfer.
export const acceptTransfer = async (
  { transferId, itemId, userId }: { transferId: string; itemId: string; userId: string },
  tx: Executor = db,
): Promise<AcceptResult> => {
  return tx.transaction(async (t) => {
    const [transfer] = await t
      .select({
        fromUserId: ownershipTransfers.fromUserId,
        ownerId: items.ownerId,
        name: items.name,
        type: items.type,
        trashedAt: items.trashedAt,
      })
      .from(ownershipTransfers)
      .innerJoin(items, eq(items.id, ownershipTransfers.itemId))
      .where(
        and(
          eq(ownershipTransfers.id, transferId),
          eq(ownershipTransfers.itemId, itemId),
          eq(ownershipTransfers.toUserId, userId),
          eq(ownershipTransfers.status, "pending"),
        ),
      )
      .for("update", { of: ownershipTransfers });
    if (!transfer || transfer.ownerId !== transfer.fromUserId || transfer.trashedAt) {
      return { ok: false, reason: "gone" };
    }
    const { fromUserId } = transfer;

    // Both trees take turns with moves, trash and uploads (they lock the
    // owner's row too); always in the same order, so two transfers can't
    // wait on each other forever.
    await t.execute(sql`
      select 1 from ${users} where id in (${fromUserId}, ${userId}) order by id for update
    `);

    const { rows: tree } = await t.execute<{
      id: string;
      size: string | null;
      pending: boolean;
      trashed: boolean;
    }>(sql`
      with recursive tree as (
        select id from ${items} where id = ${itemId}
        union all
        select i.id from ${items} i join tree t on i.parent_id = t.id
      )
      select i.id, i.size, i.status = 'pending' as pending, i.trashed_at is not null as trashed
      from ${items} i join tree t on t.id = i.id
    `);
    if (tree.some((row) => row.pending)) {
      return { ok: false, reason: "upload" };
    }
    if (tree.some((row) => row.trashed)) {
      return { ok: false, reason: "trashed" };
    }
    const ids = tree.map((row) => row.id);
    const [nested] = await t
      .select({ id: ownershipTransfers.id })
      .from(ownershipTransfers)
      .where(
        and(
          inArray(ownershipTransfers.itemId, ids),
          eq(ownershipTransfers.status, "pending"),
          sql`${ownershipTransfers.id} <> ${transferId}`,
        ),
      )
      .limit(1);
    if (nested) {
      return { ok: false, reason: "nested-offer" };
    }

    const bytes = tree.reduce((sum, row) => sum + Number(row.size ?? 0), 0);
    const reserved = await reserveStorage(userId, bytes, t);
    if (!reserved.ok) {
      return { ok: false, reason: "quota", used: reserved.used, quota: reserved.quota };
    }
    await releaseStorage(fromUserId, bytes, t);

    const name = nextAvailableName(
      transfer.name,
      await takenNames(t, { ownerId: userId, parentId: null, name: transfer.name }),
      { keepExtension: transfer.type !== "folder" },
    );
    await t
      .update(items)
      .set({ ownerId: userId, parentId: null, name })
      .where(eq(items.id, itemId));
    await t.update(items).set({ ownerId: userId }).where(inArray(items.id, ids));
    await t
      .delete(itemPermissions)
      .where(and(eq(itemPermissions.userId, userId), inArray(itemPermissions.itemId, ids)));
    await t
      .insert(itemPermissions)
      .values({ itemId, userId: fromUserId, role: "editor", grantedBy: userId })
      .onConflictDoUpdate({
        target: [itemPermissions.itemId, itemPermissions.userId],
        set: { role: "editor", grantedBy: userId },
      });
    await t
      .update(ownershipTransfers)
      .set({ status: "accepted", decidedAt: sql`now()` })
      .where(eq(ownershipTransfers.id, transferId));
    await logActivity(t, {
      itemId,
      actorId: userId,
      action: "ownership_transferred",
      metadata: { fromUserId, toUserId: userId },
    });
    return { ok: true, itemId, name };
  });
};
