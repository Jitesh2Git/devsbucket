import { z } from "zod";
import { itemIdSchema, itemIdsSchema } from "./item.ts";
import { usernameSchema } from "./user.ts";

// Sharing with people (decision 0008): only someone who already has an
// account, found by exact email or by their username, as Editor or Viewer.

export const grantRoleSchema = z.enum(["editor", "viewer"]);
export type GrantRole = z.infer<typeof grantRoleSchema>;

// Who to share with: an email, or a username with or without its "@"
// ("@ada" or "ada"). Anything with an "@" after the start is an email.
export type PersonRef = { by: "email"; email: string } | { by: "username"; username: string };

const PERSON_MESSAGE = "Enter an email or a @username";

export const personRefSchema = z
  .string()
  .trim()
  .min(1, PERSON_MESSAGE)
  .transform((value, ctx): PersonRef => {
    if (value.startsWith("@") || !value.includes("@")) {
      const username = usernameSchema.safeParse(value.replace(/^@/, ""));
      if (username.success) return { by: "username", username: username.data };
    } else {
      const email = z.email().safeParse(value);
      if (email.success) return { by: "email", email: email.data.toLowerCase() };
    }
    ctx.addIssue({ code: "custom", message: PERSON_MESSAGE });
    return z.NEVER;
  });

// The Share dialog's form: the text as typed (the server turns it into a
// PersonRef).
export const shareFormSchema = z.object({
  person: z
    .string()
    .trim()
    .refine((value) => personRefSchema.safeParse(value).success, PERSON_MESSAGE),
  role: grantRoleSchema,
});

export const shareSchema = z.object({
  itemId: itemIdSchema,
  person: personRefSchema,
  role: grantRoleSchema,
});

// The same person and role for several selected items (multi-select).
export const shareItemsSchema = z.object({
  itemIds: itemIdsSchema,
  person: personRefSchema,
  role: grantRoleSchema,
});

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

// What sharing with someone does to their grant on the item (their direct
// one; null when they have none). `keepHigher`, when sharing several items
// at once: an Editor asked to be a Viewer stays an Editor, so sharing a
// selection never takes access away. One item's dialog sets the role.
export const shareOutcome = (
  existing: GrantRole | null,
  role: GrantRole,
  keepHigher = false,
): "added" | "changed" | "unchanged" => {
  if (existing === null) return "added";
  if (existing === role || (keepHigher && existing === "editor")) return "unchanged";
  return "changed";
};
