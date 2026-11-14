import { z } from "zod";
import { itemIdSchema } from "./item.ts";
import { grantRoleSchema } from "./sharing.ts";

// Access requests (decision 0008): a role and a short, optional message.

export const REQUEST_MESSAGE_MAX = 500;

// The "You need access" form.
export const requestFormSchema = z.object({
  role: grantRoleSchema,
  message: z
    .string()
    .trim()
    .max(REQUEST_MESSAGE_MAX, `Keep it under ${REQUEST_MESSAGE_MAX} characters`),
});

export const requestAccessSchema = requestFormSchema.extend({ itemId: itemIdSchema });

// Approve gives a role (maybe not the one asked for); deny gives nothing.
export const approveRequestSchema = z.object({
  itemId: itemIdSchema,
  requestId: z.uuid(),
  role: grantRoleSchema,
});

export const denyRequestSchema = z.object({ itemId: itemIdSchema, requestId: z.uuid() });

export type RequestFormInput = z.infer<typeof requestFormSchema>;
