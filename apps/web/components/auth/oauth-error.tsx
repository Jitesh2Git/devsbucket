"use client";

import { useSearchParams } from "next/navigation";

// After a failed GitHub round trip, Better Auth sends the browser back to
// /sign-in or /sign-up with ?error=<code>. Only known codes get their own
// text: the URL is user-controlled, so error_description is never shown.
const MESSAGES: Record<string, string> = {
  INVITE_REQUIRED: "You need an invite to create an account. Enter your invite code first.",
  INVITE_INVALID: "Your invite code is invalid, used or expired.",
  signup_disabled:
    "No DevsBucket account is linked to this GitHub account. Have an invite? Create an account instead.",
  account_not_linked:
    "An account with this email already exists. Sign in with your email and password, then connect GitHub from your profile.",
  access_denied: "GitHub sign-in was cancelled.",
  account_already_linked_to_different_user:
    "This GitHub account is already connected to a different DevsBucket account.",
  unable_to_link_account: "Couldn't connect your GitHub account. Please try again.",
};

const OAuthError = () => {
  const error = useSearchParams().get("error");
  if (!error) {
    return null;
  }

  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive"
    >
      {MESSAGES[error] ?? "GitHub sign-in failed. Please try again."}
    </p>
  );
};

export default OAuthError;
