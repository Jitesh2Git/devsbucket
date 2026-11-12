import { db } from "@devsbucket/db/client";
import * as schema from "@devsbucket/db/schema/index";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
  advanced: {
    database: { generateId: "uuid" },
  },
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      storageUsed: { type: "number", required: false, input: false },
      storageQuota: { type: "number", required: false, input: false },
      isAdmin: { type: "boolean", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});
