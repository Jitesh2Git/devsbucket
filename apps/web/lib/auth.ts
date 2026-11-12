import { db } from "@devsbucket/db/client";
import * as schema from "@devsbucket/db/schema/index";
import { type BetterAuthPlugin, betterAuth, getCurrentAdapter } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { INVITE_COOKIE } from "@/lib/invite-cookie";

type Invite = typeof schema.invites.$inferSelect;

// Errors carry a `code`: email sign-up returns it in the JSON, and GitHub
// sign-up redirects back with it as `?error=` (see oauth-error.tsx).
const inviteRequired = () =>
  new APIError("BAD_REQUEST", {
    code: "INVITE_REQUIRED",
    message: "An invite code is required to sign up.",
  });

const invalidInvite = () =>
  new APIError("BAD_REQUEST", {
    code: "INVITE_INVALID",
    message: "This invite code is invalid, used or expired.",
  });

// Tells Better Auth's adapter about our `invites` table (Drizzle owns the
// real schema and migrations), so the sign-up hook can use it in the same
// transaction as the user insert.
const invitesModel = {
  id: "invites",
  schema: {
    invite: {
      fields: {
        code: { type: "string", required: true, unique: true },
        email: { type: "string", required: false },
        createdBy: { type: "string", required: false },
        usedBy: { type: "string", required: false },
        usedAt: { type: "date", required: false },
        expiresAt: { type: "date", required: true },
        createdAt: { type: "date", required: true },
      },
    },
  },
} satisfies BetterAuthPlugin;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema, transaction: true }),
  advanced: {
    database: { generateId: "uuid" },
  },
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      // "Continue with GitHub" on the sign-in page must not create accounts;
      // only the sign-up page asks for that (requestSignUp: true).
      disableImplicitSignUp: true,
    },
  },
  // GitHub is attached to an account in exactly two ways: signing up with
  // GitHub (new account), or "Connect" on the profile while signed in.
  // See docs/decisions/0005-account-linking.md.
  account: {
    accountLinking: {
      // Never attach GitHub to an existing account just because the emails
      // match ("Continue with GitHub" on sign-in). Otherwise Disconnect
      // wouldn't stick: the next GitHub sign-in would reconnect it.
      disableImplicitLinking: true,
      // "Connect" links to whoever is signed in, so the GitHub email may
      // differ from the account's.
      allowDifferentEmails: true,
      // updateUserInfoOnLink stays off: connecting must not rename the
      // account or replace its picture.
    },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      storageUsed: { type: "number", required: false, input: false },
      storageQuota: { type: "number", required: false, input: false },
      isAdmin: { type: "boolean", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const code = ctx?.getCookie(INVITE_COOKIE);
          if (!ctx || !code) throw inviteRequired();
          const adapter = await getCurrentAdapter(ctx.context.adapter);
          const invite = await adapter.update<Invite>({
            model: "invite",
            where: [
              { field: "code", value: code },
              { field: "usedAt", value: null },
              { field: "expiresAt", operator: "gt", value: new Date() },
            ],
            update: { usedAt: new Date() },
          });
          if (!invite) throw invalidInvite();
          if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
            throw invalidInvite();
          }
        },
        after: async (user, ctx) => {
          const code = ctx?.getCookie(INVITE_COOKIE);
          if (!ctx || !code) return;
          await ctx.context.adapter.update({
            model: "invite",
            where: [
              { field: "code", value: code },
              { field: "usedBy", value: null },
            ],
            update: { usedBy: user.id },
          });
        },
      },
    },
    session: {
      create: {
        // Any sign-in ends the invite flow, even one that didn't use the code
        // (e.g. "Continue with GitHub" on /sign-up for an existing account).
        // Otherwise the code would stay in this browser for the next person.
        after: async (_session, ctx) => {
          if (ctx?.getCookie(INVITE_COOKIE)) {
            ctx.setCookie(INVITE_COOKIE, "", { path: "/", maxAge: 0 });
          }
        },
      },
    },
  },
  plugins: [invitesModel, nextCookies()],
});
