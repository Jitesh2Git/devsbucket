import { openLink } from "@devsbucket/db/share-links";
import { linkTokenSchema, shareLinkPath } from "@devsbucket/shared/share-links";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// GET /s/<token>: a share link (decision 0008). Signed out: sign in first,
// then back here. A working link records the visit (which gives its role
// from then on) and sends you to the item: a folder opens in the drive, a
// file in the preview on Shared with me. Anything else: "This link no
// longer works", the same for a wrong, disabled or expired token.
export const GET = async (request: Request, { params }: RouteContext<"/s/[token]">) => {
  const [{ token }, session] = await Promise.all([
    params,
    auth.api.getSession({ headers: request.headers }),
  ]);
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!linkTokenSchema.safeParse(token).success) {
    return to("/s/unavailable");
  }
  if (!session) {
    return to(`/sign-in?next=${encodeURIComponent(shareLinkPath(token))}`);
  }
  const opened = await openLink({ token, userId: session.user.id });
  if (!opened) {
    return to("/s/unavailable");
  }
  return to(
    opened.type === "folder"
      ? `/drive/folders/${opened.itemId}`
      : `/drive/shared?file=${opened.itemId}`,
  );
};
