import { recordActivity } from "@devsbucket/db/activity";
import { contentDisposition } from "@devsbucket/shared/preview";
import { itemKey, presignGet } from "@devsbucket/storage/objects";
import { auth } from "@/lib/auth";
import { resolveFile } from "@/lib/items";

// GET /api/items/<id>/download: a redirect to a one-minute storage URL that
// downloads the file under its name. The browser follows it immediately, so
// the URL is useless to anyone who copies it later.
export const GET = async (
  request: Request,
  { params }: RouteContext<"/api/items/[itemId]/download">,
) => {
  const [{ itemId }, session] = await Promise.all([
    params,
    auth.api.getSession({ headers: request.headers }),
  ]);
  if (!session) {
    return new Response("Not found", { status: 404 });
  }
  const found = await resolveFile(session.user, itemId, "download");
  // Anyone with a role may download (decision 0012). Anyone without one
  // gets the same 404 as a missing file.
  if (found.denied) {
    return new Response("Not found", { status: 404 });
  }
  const file = found.item;
  await recordActivity({
    itemId: file.id,
    actorId: session.user.id,
    action: "downloaded",
    metadata: {},
  });
  const url = await presignGet({
    key: itemKey(file.id),
    contentDisposition: contentDisposition("attachment", file.name),
    expiresIn: 60,
  });
  return Response.redirect(url, 302);
};
