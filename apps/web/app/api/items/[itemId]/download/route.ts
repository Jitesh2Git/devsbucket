import { contentDisposition } from "@devsbucket/shared/preview";
import { itemKey, presignGet } from "@devsbucket/storage/objects";
import { auth } from "@/lib/auth";
import { resolveFile } from "@/lib/files";

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
  const file = session ? await resolveFile(session.user, itemId, "download") : null;
  if (!file) {
    return new Response("Not found", { status: 404 });
  }
  const url = await presignGet({
    key: itemKey(file.id),
    contentDisposition: contentDisposition("attachment", file.name),
    expiresIn: 60,
  });
  return Response.redirect(url, 302);
};
