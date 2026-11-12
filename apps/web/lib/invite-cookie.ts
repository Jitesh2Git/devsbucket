// Holds the invite code between "enter your invite code" and creating the
// account (and, from step 11, the round trip to GitHub). The sign-up hook in
// lib/auth.ts reads it and uses the invite up.
export const INVITE_COOKIE = "devsbucket.invite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60; // 1 hour, in seconds
