import { z } from "zod";
import { parseBytes } from "./bytes.ts";

// Inputs of the admin page's server actions (apps/web/app/admin/actions.ts).

export const userRefSchema = z.object({ userId: z.uuid() });

export const setAdminSchema = z.object({ userId: z.uuid(), isAdmin: z.boolean() });

// Typed sizes like the command's: "5GB", "500 MB", "1073741824".
export const setQuotaSchema = z.object({
  userId: z.uuid(),
  size: z
    .string()
    .trim()
    .refine((size) => {
      try {
        parseBytes(size);
        return true;
      } catch {
        return false;
      }
    }, "Enter a size like 5GB or 500MB"),
});

// An empty email means anyone can use the invite.
export const createInviteSchema = z.object({
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
});

export const inviteRefSchema = z.object({ inviteId: z.uuid() });

export type SetQuotaInput = z.infer<typeof setQuotaSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
