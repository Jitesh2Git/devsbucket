// Saved versions of a text file (Phase 4, decision 0015): written by
// realtime when the last person leaves (automatic) or when someone saves a
// named version. Each holds the full text.
import { MAX_AUTO_VERSIONS } from "@devsbucket/shared/editing";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { users } from "./schema/auth.ts";
import { itemVersions } from "./schema/collab.ts";
import { items } from "./schema/items.ts";
import { addStorage } from "./usage.ts";

const byteLength = (text: string) => Buffer.byteLength(text, "utf8");

type SaveVersion = {
  itemId: string;
  // The live text to save.
  text: string;
  // The file's text before the first edit, read only when it has no
  // versions yet: it becomes version 1.
  firstText: () => Promise<string>;
  kind: "auto" | "named" | "restore";
  // Named versions only.
  message?: string;
  // Named and restore versions: who did it.
  savedBy?: string;
  // Restore versions: the version brought back.
  restoredFrom?: { id: string; number: number };
  // Who changed the text in this editing session.
  authors: string[];
};

// Saves the text as the next version, or nothing if it equals the latest
// one. In one transaction: version 1 first if the file has none, the new
// version, the file's size (and its owner's used storage, by the
// difference), activity, and only the newest MAX_AUTO_VERSIONS automatic
// versions kept. Returns the latest version's number (null: no such file).
// The caller rewrites the file in storage when `saved` is true.
export const saveVersion = async (input: SaveVersion, executor: Executor = db) =>
  executor.transaction(async (tx) => {
    const { itemId, text, kind, authors } = input;
    // Locked, so two saves of the same file take turns for the number.
    const [file] = await tx
      .select({ ownerId: items.ownerId, size: items.size })
      .from(items)
      .where(eq(items.id, itemId))
      .for("update");
    if (!file) {
      return { saved: false, number: null } as const;
    }
    let [latest] = await tx
      .select({ number: itemVersions.number, content: itemVersions.content })
      .from(itemVersions)
      .where(eq(itemVersions.itemId, itemId))
      .orderBy(desc(itemVersions.number))
      .limit(1);
    if (!latest) {
      const content = await input.firstText();
      await tx
        .insert(itemVersions)
        .values({ itemId, number: 1, kind: "auto", content, size: byteLength(content) });
      latest = { number: 1, content };
    }

    // "edited" is logged for authors who still have an account (one removed
    // mid-session would break the activity's foreign key and the save).
    const editors =
      kind === "auto" && authors.length > 0
        ? (await tx.select({ id: users.id }).from(users).where(inArray(users.id, authors))).map(
            (user) => user.id,
          )
        : [];

    if (latest.content === text) {
      // Nothing new to keep; an editing session still counts as edited.
      if (kind === "auto") {
        for (const actorId of editors) {
          await logActivity(tx, {
            itemId,
            actorId,
            action: "edited",
            metadata: { versionNumber: latest.number },
          });
        }
      }
      return { saved: false, number: latest.number } as const;
    }

    const number = latest.number + 1;
    const size = byteLength(text);
    await tx.insert(itemVersions).values({
      itemId,
      number,
      kind,
      message: kind === "named" ? input.message : null,
      content: text,
      size,
      authors,
      restoredFrom: input.restoredFrom?.id ?? null,
      createdBy: kind === "auto" ? null : input.savedBy,
    });
    // The file in storage becomes this text, so its size and its owner's
    // used storage follow. Versions themselves aren't counted.
    await tx.update(items).set({ size }).where(eq(items.id, itemId));
    await addStorage(file.ownerId, size - (file.size ?? 0), tx);

    if (kind === "named") {
      await logActivity(tx, {
        itemId,
        actorId: input.savedBy ?? null,
        action: "version_saved",
        metadata: { versionNumber: number, message: input.message ?? "" },
      });
    } else if (kind === "restore") {
      await logActivity(tx, {
        itemId,
        actorId: input.savedBy ?? null,
        action: "version_restored",
        metadata: { versionNumber: number, from: input.restoredFrom?.number ?? 0 },
      });
    } else {
      for (const actorId of editors) {
        await logActivity(tx, {
          itemId,
          actorId,
          action: "edited",
          metadata: { versionNumber: number },
        });
      }
    }

    // Keep the newest automatic versions; version 1 and named ones stay.
    await tx.execute(sql`
      delete from ${itemVersions}
      where item_id = ${itemId} and kind = 'auto' and number > 1
        and number not in (
          select number from ${itemVersions}
          where item_id = ${itemId} and kind = 'auto' and number > 1
          order by number desc
          limit ${MAX_AUTO_VERSIONS}
        )
    `);
    return { saved: true, number } as const;
  });

// A file's versions for the history panel, newest first, without their
// text, with the names of the people who changed it (a removed account
// shows as "Deleted user") and of who saved or restored it.
export const listVersions = async (itemId: string, tx: Executor = db) => {
  const rows = await tx
    .select({
      id: itemVersions.id,
      number: itemVersions.number,
      kind: itemVersions.kind,
      message: itemVersions.message,
      size: itemVersions.size,
      createdAt: itemVersions.createdAt,
      restoredFromNumber: sql<number | null>`(
        select r.number from ${itemVersions} r where r.id = ${itemVersions.restoredFrom}
      )`,
      savedBy: users.name,
      authors: sql<string[]>`array(
        select coalesce(u.name, 'Deleted user')
        from unnest(${itemVersions.authors}) as a(id)
        left join ${users} u on u.id = a.id
      )`,
    })
    .from(itemVersions)
    .leftJoin(users, eq(users.id, itemVersions.createdBy))
    .where(eq(itemVersions.itemId, itemId))
    .orderBy(desc(itemVersions.number));
  return rows;
};

export type VersionSummary = Awaited<ReturnType<typeof listVersions>>[number];

// One version's text, if it belongs to this file.
export const getVersion = async (itemId: string, versionId: string, tx: Executor = db) => {
  const [version] = await tx
    .select({ id: itemVersions.id, number: itemVersions.number, content: itemVersions.content })
    .from(itemVersions)
    .where(and(eq(itemVersions.itemId, itemId), eq(itemVersions.id, versionId)));
  return version ?? null;
};
