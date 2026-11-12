import { eq } from "drizzle-orm";
import { db } from "./client.ts";
import { isUniqueViolation } from "./errors.ts";
import { users } from "./schema/auth.ts";

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
