import { findOpenInvite } from "@devsbucket/db/invites";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import InviteForm from "@/components/auth/invite-form";
import SignUpForm from "@/components/auth/sign-up-form";
import { INVITE_COOKIE } from "@/lib/invite-cookie";

export const metadata: Metadata = { title: "Sign up" };

// Reads a cookie, so it renders per request; with Cache Components that
// has to happen inside <Suspense>.
const SignUpStep = async () => {
  const code = (await cookies()).get(INVITE_COOKIE)?.value;
  const invite = code ? await findOpenInvite(code) : null;

  if (!invite) {
    return <InviteForm />;
  }
  return <SignUpForm lockedEmail={invite.email} />;
};

const SignUpPage = () => {
  return (
    <Suspense>
      <SignUpStep />
    </Suspense>
  );
};

export default SignUpPage;
