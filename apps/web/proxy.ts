import { safeNextPath } from "@devsbucket/shared/redirect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/sign-in", "/sign-up"];
// Where signed-in people land.
const HOME = "/drive";

// Fast redirects before a page renders. This is a convenience, not the
// security check: signed-in pages still verify the session themselves.
// It checks the session for real (one indexed lookup), not just whether a
// cookie exists: a stale cookie would otherwise lock someone out of /sign-in.
export const proxy = async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  const { pathname } = request.nextUrl;
  const onAuthPage = AUTH_PAGES.includes(pathname);
  // The landing page is for everyone, but signed-in people go to their drive.
  const onLanding = pathname === "/";

  if (session && (onAuthPage || onLanding)) {
    // Already signed in, coming from a share link: straight back to it.
    const next = onAuthPage ? safeNextPath(request.nextUrl.searchParams.get("next")) : null;
    return NextResponse.redirect(new URL(next ?? HOME, request.url));
  }

  // Signed out: every other matched page needs an account.
  if (!session && !onAuthPage && !onLanding) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/", "/sign-in", "/sign-up", "/profile", "/admin", "/drive/:path*"],
};
