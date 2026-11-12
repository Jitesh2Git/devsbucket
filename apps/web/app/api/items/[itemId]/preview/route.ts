import { contentDisposition, inlineContentType } from "@devsbucket/shared/preview";
import { itemKey, presignGet } from "@devsbucket/storage/objects";
import { auth } from "@/lib/auth";
import { resolveFile } from "@/lib/files";

// GET /api/items/<id>/preview: a redirect to storage that shows the file in
// the browser, for images, video, audio and PDFs only. We pick the
// Content-Type from that allowlist; anything else (SVG, HTML, unknown) is
// never served inline, whatever type it was uploaded with.
export const GET = async (
  request: Request,
  { params }: RouteContext<"/api/items/[itemId]/preview">,
) => {
  const [{ itemId }, session] = await Promise.all([
    params,
    auth.api.getSession({ headers: request.headers }),
  ]);
  const file = session ? await resolveFile(session.user, itemId, "view") : null;
  const contentType = file ? inlineContentType(file.name) : null;
  if (!file || !contentType) {
    return new Response("Not found", { status: 404 });
  }
  const url = await presignGet({
    key: itemKey(file.id),
    contentDisposition: contentDisposition("inline", file.name),
    contentType,
    // Long enough to watch a video: players ask for more ranges as it plays.
    expiresIn: 60 * 60,
  });
  return Response.redirect(url, 302);
};
