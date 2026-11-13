// Sharing with people (decision 0008): the grants on an item, and changing
// them. Each change logs activity in its own transaction (decision 0010).
// Callers check `can(access, "share")` / "change_settings" first.
import type { GrantRole, SharingSetting } from "@devsbucket/shared/sharing";
import { and, eq, sql } from "drizzle-orm";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";

const rank = { viewer: 1, editor: 2 } as const;

export type SharingPerson = {
  userId: string;
  name: string;
  email: string;
  // What they can do here: the higher of their grant here and above.
  role: GrantRole;
  // Their grant on this item (changeable here), if any.
  direct: GrantRole | null;
  // The folder above that gives them the most, if any (changed there).
  inherited: { itemId: string; name: string; role: GrantRole } | null;
};

// Who has access to an item: its owner, and everyone with a grant on it or
// on a folder above it, plus the item’s own setting and the effective one
// (off if any folder above turned it off).
export const listSharing = async (itemId: string, tx: Executor = db) => {
  const result = await tx.execute<{
    owner_id: string;
    owner_name: string;
    owner_email: string;
    own_editors_can_share: boolean;
    editors_can_share: boolean;
  }>(sql`
    with recursive chain as (
      select id, parent_id, editors_can_share, 0 as depth
      from ${items} where id = ${itemId}
      union all
      select i.id, i.parent_id, i.editors_can_share, c.depth + 1
      from ${items} i join chain c on i.id = c.parent_id
      where c.depth < 100
    )
    select u.id as owner_id, u.name as owner_name, u.email as owner_email,
      i.editors_can_share as own_editors_can_share,
      (select bool_and(editors_can_share) from chain) as editors_can_share
    from ${items} i join ${users} u on u.id = i.owner_id
    where i.id = ${itemId}
  `);
  const item = result.rows[0];
  if (!item) {
    return null;
  }
  const grants = await tx.execute<{
    user_id: string;
    name: string;
    email: string;
    role: GrantRole;
    source_id: string;
    source_name: string;
    depth: number;
  }>(sql`
    with recursive chain as (
      select id, parent_id, name, 0 as depth from ${items} where id = ${itemId}
      union all
      select i.id, i.parent_id, i.name, c.depth + 1
      from ${items} i join chain c on i.id = c.parent_id
      where c.depth < 100
    )
    select p.user_id, u.name, u.email, p.role, c.id as source_id, c.name as source_name, c.depth
    from ${itemPermissions} p
    join chain c on c.id = p.item_id
    join ${users} u on u.id = p.user_id
    order by c.depth
  `);

  const people = new Map<string, SharingPerson>();
  for (const grant of grants.rows) {
    const person = people.get(grant.user_id) ?? {
      userId: grant.user_id,
      name: grant.name,
      email: grant.email,
      role: grant.role,
      direct: null,
      inherited: null,
    };
    if (grant.depth === 0) {
      person.direct = grant.role;
    } else if (!person.inherited || rank[grant.role] > rank[person.inherited.role]) {
      // Rows come nearest first, so a tie keeps the nearest folder.
      person.inherited = { itemId: grant.source_id, name: grant.source_name, role: grant.role };
    }
    people.set(grant.user_id, person);
  }
  // Grants only add access: the higher of the two counts.
  for (const person of people.values()) {
    const inherited = person.inherited?.role;
    person.role =
      person.direct && (!inherited || rank[person.direct] >= rank[inherited])
        ? person.direct
        : (inherited ?? person.role);
  }

  return {
    owner: { userId: item.owner_id, name: item.owner_name, email: item.owner_email },
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    settings: {
      own: { editorsCanShare: item.own_editors_can_share },
      effective: { editorsCanShare: item.editors_can_share },
    },
  };
};

export type Sharing = NonNullable<Awaited<ReturnType<typeof listSharing>>>;

// Gives `userId` a role on the item, or changes their grant there.
export const shareItem = async ({
  itemId,
  userId,
  role,
  actorId,
}: {
  itemId: string;
  userId: string;
  role: GrantRole;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ role: itemPermissions.role })
      .from(itemPermissions)
      .where(and(eq(itemPermissions.itemId, itemId), eq(itemPermissions.userId, userId)))
      .for("update");
    if (existing?.role === role) {
      return "unchanged" as const;
    }
    // Two shares at once: the unique (item, user) decides, the second updates.
    await tx
      .insert(itemPermissions)
      .values({ itemId, userId, role, grantedBy: actorId })
      .onConflictDoUpdate({
        target: [itemPermissions.itemId, itemPermissions.userId],
        set: { role, grantedBy: actorId },
      });
    if (existing) {
      await logActivity(tx, {
        itemId,
        actorId,
        action: "access_changed",
        metadata: { userId, from: existing.role, to: role },
      });
      return "changed" as const;
    }
    await logActivity(tx, { itemId, actorId, action: "shared", metadata: { userId, role } });
    return "added" as const;
  });
};

// Changes an existing grant on the item; false if there's none any more.
export const changeGrant = async (entry: {
  itemId: string;
  userId: string;
  role: GrantRole;
  actorId: string;
}) => {
  const [existing] = await db
    .select({ id: itemPermissions.id })
    .from(itemPermissions)
    .where(and(eq(itemPermissions.itemId, entry.itemId), eq(itemPermissions.userId, entry.userId)));
  return existing ? (await shareItem(entry)) !== "added" : false;
};

// Removes someone's grant on the item; false if there was none.
export const removeGrant = async ({
  itemId,
  userId,
  actorId,
}: {
  itemId: string;
  userId: string;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(itemPermissions)
      .where(and(eq(itemPermissions.itemId, itemId), eq(itemPermissions.userId, userId)))
      .returning({ role: itemPermissions.role });
    if (!removed) {
      return false;
    }
    await logActivity(tx, {
      itemId,
      actorId,
      action: "access_removed",
      metadata: { userId, role: removed.role },
    });
    return true;
  });
};

// The Owner's switches. Off here is off for everything inside (item_access).
export const setSharingSetting = async ({
  itemId,
  setting,
  value,
  actorId,
}: {
  itemId: string;
  setting: SharingSetting;
  value: boolean;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(items)
      .set({ [setting]: value })
      .where(and(eq(items.id, itemId), sql`${items[setting]} is distinct from ${value}`))
      .returning({ id: items.id });
    if (updated) {
      await logActivity(tx, {
        itemId,
        actorId,
        action: "settings_changed",
        metadata: { setting, value },
      });
    }
  });
};
