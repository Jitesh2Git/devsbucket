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
  // A Viewer when the Owner turned downloads off: 403. Anyone without a
  // role gets the same 404 as a missing file.
  if (found.denied === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }
  if (found.denied) {
    return new Response("Not found", { status: 404 });
  }
  const file = found.item;
  const url = await presignGet({
    key: itemKey(file.id),
    contentDisposition: contentDisposition("attachment", file.name),
    expiresIn: 60,
  });
  return Response.redirect(url, 302);
};
