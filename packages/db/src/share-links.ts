// Share links (decision 0008): create, change, disable and open them. Each
// change logs activity in its own transaction (decision 0010). Callers
// check `can(access, "share")` before managing a link; opening one only
// needs a signed-in user.
import { randomBytes } from "node:crypto";
import type { GrantRole } from "@devsbucket/shared/sharing";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { items } from "./schema/items.ts";
import { shareLinks, shareLinkVisits } from "./schema/share-links.ts";

const newToken = () => randomBytes(32).toString("base64url");

const iso = (date: Date | null) => (date ? date.toISOString() : null);

// The item's link that hasn't been disabled (it may have expired), with how
// many people opened it; null if there's none.
export const getActiveLink = async (itemId: string, tx: Executor = db) => {
  const [link] = await tx
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      role: shareLinks.role,
      expiresAt: shareLinks.expiresAt,
      visitors: count(shareLinkVisits.userId),
    })
    .from(shareLinks)
    .leftJoin(shareLinkVisits, eq(shareLinkVisits.linkId, shareLinks.id))
    .where(and(eq(shareLinks.itemId, itemId), isNull(shareLinks.disabledAt)))
    .groupBy(shareLinks.id);
  return link ?? null;
};

export type ActiveLink = NonNullable<Awaited<ReturnType<typeof getActiveLink>>>;

// A new link for the item, replacing (disabling) the active one if there
// is one: creating and resetting are the same thing. The item's row is
// locked first, so two at once take turns instead of both inserting.
export const createLink = async ({
  itemId,
  role,
  expiresAt,
  actorId,
}: {
  itemId: string;
  role: GrantRole;
  expiresAt: Date | null;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from ${items} where id = ${itemId} for update`);
    await tx
      .update(shareLinks)
      .set({ disabledAt: sql`now()` })
      .where(and(eq(shareLinks.itemId, itemId), isNull(shareLinks.disabledAt)));
    const token = newToken();
    await tx.insert(shareLinks).values({ itemId, token, role, expiresAt, createdBy: actorId });
    await logActivity(tx, {
      itemId,
      actorId,
      action: "link_created",
      metadata: { role, expiresAt: iso(expiresAt) },
    });
    return token;
  });
};

// Changes the active link's role and/or expiry (undefined = keep); its
// token, and the people who opened it, stay. False if there's no link.
export const changeLink = async ({
  itemId,
  role,
  expiresAt,
  actorId,
}: {
  itemId: string;
  role?: GrantRole;
  expiresAt?: Date | null;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .update(shareLinks)
      .set({ role, expiresAt })
      .where(and(eq(shareLinks.itemId, itemId), isNull(shareLinks.disabledAt)))
      .returning({ role: shareLinks.role, expiresAt: shareLinks.expiresAt });
    if (!link) {
      return false;
    }
    await logActivity(tx, {
      itemId,
      actorId,
      action: "link_changed",
      metadata: { role: link.role, expiresAt: iso(link.expiresAt) },
    });
    return true;
  });
};

// Turns the link off: its token stops working, and so does the access it
// gave. False if there was no link.
export const disableLink = async ({ itemId, actorId }: { itemId: string; actorId: string }) => {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .update(shareLinks)
      .set({ disabledAt: sql`now()` })
      .where(and(eq(shareLinks.itemId, itemId), isNull(shareLinks.disabledAt)))
      .returning({ id: shareLinks.id });
    if (!link) {
      return false;
    }
    await logActivity(tx, { itemId, actorId, action: "link_disabled", metadata: {} });
    return true;
  });
};

// Someone signed in opens /s/<token>. A link that's disabled, expired, or
// whose item is in the trash or gone doesn't work. The first open records
// a visit (which gives the link's role from then on) and logs link_opened;
// the owner needs no visit.
export const openLink = async ({ token, userId }: { token: string; userId: string }) => {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .select({
        id: shareLinks.id,
        role: shareLinks.role,
        itemId: items.id,
        type: items.type,
        ownerId: items.ownerId,
      })
      .from(shareLinks)
      .innerJoin(items, eq(items.id, shareLinks.itemId))
      .where(
        and(
          eq(shareLinks.token, token),
          isNull(shareLinks.disabledAt),
          sql`(${shareLinks.expiresAt} is null or ${shareLinks.expiresAt} > now())`,
          isNull(items.trashedAt),
          eq(items.status, "ready"),
        ),
      );
    if (!link) {
      return null;
    }
    if (link.ownerId !== userId) {
      const opened = await tx
        .insert(shareLinkVisits)
        .values({ linkId: link.id, userId })
        .onConflictDoNothing()
        .returning({ userId: shareLinkVisits.userId });
      if (opened.length > 0) {
        await logActivity(tx, {
          itemId: link.itemId,
          actorId: userId,
          action: "link_opened",
          metadata: { role: link.role },
        });
      }
    }
    return { itemId: link.itemId, type: link.type };
  });
};
