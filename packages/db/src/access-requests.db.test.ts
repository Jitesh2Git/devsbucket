import { randomUUID } from "node:crypto";
import { TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getPendingRequest, listPendingRequests } from "./access-requests.ts";
import { db, type Executor, pool } from "./client.ts";
import { isUniqueViolation } from "./errors.ts";
import { accessRequests } from "./schema/access-requests.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";

// Requesting, approving and denying through the app are in
// e2e/access-requests.spec.ts; these check the rules the table enforces.
const withRollback = async (fn: (tx: Executor) => Promise<void>) => {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
};

const addUser = async (tx: Executor, name: string) => {
  const [user] = await tx
    .insert(users)
    .values({ name, email: `${name}-${randomUUID()}@example.test` })
    .returning({ id: users.id });
  return user?.id ?? "";
};

const setUp = async (tx: Executor) => {
  const ada = await addUser(tx, "ada");
  const bob = await addUser(tx, "bob");
  const [team] = await tx
    .insert(items)
    .values({ ownerId: ada, type: "folder", name: "Team" })
    .returning({ id: items.id });
  return { ada, bob, team: team?.id ?? "" };
};

afterAll(async () => {
  await pool.end();
});

describe("access requests", () => {
  it("allows one pending request per person per item", async () => {
    await withRollback(async (tx) => {
      const { bob, team } = await setUp(tx);
      await tx.insert(accessRequests).values({ itemId: team, requesterId: bob, role: "viewer" });
      // A savepoint, so the failed insert doesn't end the test's transaction.
      const second = tx.transaction(async (inner) => {
        await inner
          .insert(accessRequests)
          .values({ itemId: team, requesterId: bob, role: "editor" });
      });
      await expect(second).rejects.toSatisfy(isUniqueViolation);
    });
  });

  it("lets them ask again once a request is decided, and lists only pending ones", async () => {
    await withRollback(async (tx) => {
      const { ada, bob, team } = await setUp(tx);
      await tx.insert(accessRequests).values([
        { itemId: team, requesterId: bob, role: "editor", status: "denied", decidedBy: ada },
        { itemId: team, requesterId: bob, role: "viewer", message: "please" },
      ]);
      expect(await listPendingRequests(team, tx)).toMatchObject([
        { name: "bob", role: "viewer", message: "please" },
      ]);
      expect(await getPendingRequest(team, bob, tx)).toMatchObject({ role: "viewer" });
      expect(await getPendingRequest(team, ada, tx)).toBeNull();
    });
  });
});
