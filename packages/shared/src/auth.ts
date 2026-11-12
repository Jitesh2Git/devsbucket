import { z } from "zod";

// One rule for every new password: sign-up, set password, change password.
const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const inviteCodeSchema = z.object({
  code: z.string().trim().min(1, "Enter your invite code"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Name is too long"),
  email: z.email("Enter a valid email address"),
  password: newPasswordSchema,
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

// For accounts that have no password yet (signed up with GitHub).
export const setPasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type InviteCodeInput = z.infer<typeof inviteCodeSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
