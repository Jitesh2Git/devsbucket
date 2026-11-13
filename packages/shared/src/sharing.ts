import { z } from "zod";
import { itemIdSchema } from "./item.ts";

// Sharing with people (decision 0008): only someone who already has an
// account, found by exact email, as Editor or Viewer.

export const grantRoleSchema = z.enum(["editor", "viewer"]);
export type GrantRole = z.infer<typeof grantRoleSchema>;

// The Share dialog's form.
export const shareFormSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: grantRoleSchema,
});

export const shareSchema = shareFormSchema.extend({ itemId: itemIdSchema });

export const grantRefSchema = z.object({ itemId: itemIdSchema, userId: z.uuid() });

export const changeGrantSchema = grantRefSchema.extend({ role: grantRoleSchema });

// Owner only. One setting for now (decision 0012), named so more can come.
export const sharingSettingSchema = z.object({
  itemId: itemIdSchema,
  setting: z.enum(["editorsCanShare"]),
  value: z.boolean(),
});

export type ShareFormInput = z.infer<typeof shareFormSchema>;
export type SharingSetting = z.infer<typeof sharingSettingSchema>["setting"];

export const roleLabel = (role: GrantRole | "owner") =>
  ({ owner: "Owner", editor: "Editor", viewer: "Viewer" })[role];
