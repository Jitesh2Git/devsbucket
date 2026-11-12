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
