import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Signed-in users have no business on the sign-in and sign-up pages, so send
// them home. This checks the session for real (one indexed lookup), not just
// whether a cookie exists: a stale cookie would otherwise lock someone out
// of the sign-in page.
export const proxy = async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/sign-in", "/sign-up"],
};
