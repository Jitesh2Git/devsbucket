import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { type Executor, pool } from "./client.ts";
import { databaseIsUp } from "./health.ts";
import * as schema from "./schema/index.ts";

// Nothing listens on port 1: a database that's down.
const downPool = new Pool({ connectionString: "postgres://nobody:nothing@127.0.0.1:1/none" });
const down = drizzle({ client: downPool, schema, casing: "snake_case" });

// A database that never answers.
const hanging = { execute: () => new Promise(() => {}) } as unknown as Executor;

afterAll(async () => {
  await Promise.all([pool.end(), downPool.end()]);
});

describe("databaseIsUp", () => {
  it("is true when the database answers", async () => {
    expect(await databaseIsUp()).toBe(true);
  });

  it("is false when it can't connect", async () => {
    expect(await databaseIsUp(down)).toBe(false);
  });

  it("is false when the database doesn't answer in time", async () => {
    expect(await databaseIsUp(hanging, 50)).toBe(false);
  });
});
