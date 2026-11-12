import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/sign-in", "/sign-up"];

// Fast redirects before a page renders. This is a convenience, not the
// security check: signed-in pages still verify the session themselves.
// It checks the session for real (one indexed lookup), not just whether a
// cookie exists: a stale cookie would otherwise lock someone out of /sign-in.
export const proxy = async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  const onAuthPage = AUTH_PAGES.includes(request.nextUrl.pathname);

  // Signed in: nothing to do on the sign-in and sign-up pages.
  if (session && onAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  // Signed out: every other matched page needs an account.
  if (!session && !onAuthPage) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/sign-in", "/sign-up", "/profile"],
};
