import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers and hyphens, with no hyphen at the start or end",
  );

export type Username = z.infer<typeof usernameSchema>;

export const setUsernameSchema = z.object({ username: usernameSchema });

export type SetUsernameInput = z.infer<typeof setUsernameSchema>;

// A person's display name: what others see when they share, in activity
// and in "Also here". Sign-up and the profile use the same rule.
export const nameSchema = z.string().trim().min(1, "Enter your name").max(100, "Name is too long");

export const setNameSchema = z.object({ name: nameSchema });

export type SetNameInput = z.infer<typeof setNameSchema>;
