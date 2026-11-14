import { z } from "zod";
import { itemIdSchema } from "./item.ts";
import { grantRoleSchema } from "./sharing.ts";

// Share links (decision 0008): a role, and how long the link works.

export const linkExpirySchema = z.enum(["never", "1d", "7d", "30d"]);
export type LinkExpiry = z.infer<typeof linkExpirySchema>;

export const linkExpiryLabels: Record<LinkExpiry, string> = {
  never: "Never",
  "1d": "1 day",
  "7d": "7 days",
  "30d": "30 days",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS: Record<LinkExpiry, number | null> = { never: null, "1d": 1, "7d": 7, "30d": 30 };

// When a link chosen now stops working; null = never.
export const expiresAtFor = (expiry: LinkExpiry, now = new Date()) => {
  const days = DAYS[expiry];
  return days === null ? null : new Date(now.getTime() + days * DAY_MS);
};

// Works: not disabled (or replaced by a reset), and not past its expiry.
// item_access() applies the same rule in SQL.
export const isLinkActive = (
  link: { disabledAt: Date | null; expiresAt: Date | null },
  now = new Date(),
) => link.disabledAt === null && (link.expiresAt === null || link.expiresAt > now);

// 32 random bytes in base64url are 43 characters.
export const linkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const shareLinkPath = (token: string) => `/s/${token}`;

// A new link, or a reset (a new token). No expiry on a reset: it keeps the
// old link's, unless that has passed.
export const createLinkSchema = z.object({
  itemId: itemIdSchema,
  role: grantRoleSchema,
  expiry: linkExpirySchema.optional(),
});

// The active link's role or expiry; its token stays.
export const changeLinkSchema = z
  .object({
    itemId: itemIdSchema,
    role: grantRoleSchema.optional(),
    expiry: linkExpirySchema.optional(),
  })
  .refine((value) => value.role !== undefined || value.expiry !== undefined, {
    message: "Nothing to change",
  });
