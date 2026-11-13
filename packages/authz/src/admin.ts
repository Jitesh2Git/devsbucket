// The admin page (decision 0011): only users marked as admins
// (`pnpm admin set-admin`, or another admin on the page).

export const adminActions = [
  "view", // open /admin
  "manage_invites", // create and revoke invites
  "reset_password",
  "set_quota",
  "set_admin", // make or stop being an admin
  "sign_out", // end all of someone's sessions
  "remove_user",
] as const;

export type AdminAction = (typeof adminActions)[number];

export type AuthzAdmin = { id: string; isAdmin?: boolean | null };

// What an admin can't do to their own account from the page, so they can't
// lock themselves out by accident. Their own password lives in Profile.
const notOnYourself: ReadonlySet<AdminAction> = new Set([
  "reset_password",
  "set_admin",
  "sign_out",
  "remove_user",
]);

export const canAdmin = (
  user: AuthzAdmin,
  action: AdminAction,
  target?: { id: string },
): boolean => {
  if (user.isAdmin !== true) {
    return false;
  }
  return !(target?.id === user.id && notOnYourself.has(action));
};
