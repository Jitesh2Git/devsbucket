import { eq } from "drizzle-orm";
import { db } from "./client.ts";
import { users } from "./schema/auth.ts";

// Postgres error code for a unique constraint violation.
const UNIQUE_VIOLATION = "23505";

// Drizzle wraps the driver error; the Postgres code is on `cause`.
const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  (error.cause as { code?: string } | undefined)?.code === UNIQUE_VIOLATION;

// Usernames are unique (see schema/auth.ts), so a race between two people
// picking the same name is settled by the database, not by a lookup first.
export const setUsername = async (userId: string, username: string) => {
  try {
    await db.update(users).set({ username }).where(eq(users.id, userId));
    return { ok: true } as const;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "taken" } as const;
    }
    throw error;
  }
};
