import { recordActivity } from "@devsbucket/db/activity";
import { listZipEntries, zipSummary } from "@devsbucket/db/zip";
import { itemRefsSchema } from "@devsbucket/shared/item";
import { selectionZipName } from "@devsbucket/shared/limits";
import { contentDisposition } from "@devsbucket/shared/preview";
import { getObjectStream, itemKey } from "@devsbucket/storage/objects";
import { downloadZip } from "client-zip";
import { auth } from "@/lib/auth";
import { resolveZipSelection } from "@/lib/zip-selection";

// POST /api/zip: several selected items as one ZIP (multi-select). A form
// post, not a link: up to 500 ids don't fit in a URL, and the browser
// downloads the answer (an attachment) while the page stays. Streamed like
// a folder's ZIP (/api/items/<id>/zip): selected files at the top, each
// selected folder with everything inside it.
export const POST = async (request: Request) => {
  // Only our own pages: the browser says where a form post comes from,
  // and the session cookie (SameSite=Lax) isn't sent from other sites.
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    return new Response("Forbidden", { status: 403 });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Not found", { status: 404 });
  }
  const form = await request.formData();
  let itemIds: unknown;
  try {
    itemIds = JSON.parse(String(form.get("itemIds") ?? ""));
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
  const parsed = itemRefsSchema.safeParse({ itemIds });
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }
  const selection = await resolveZipSelection(session.user, parsed.data.itemIds);
  if (selection.error !== null) {
    return new Response(selection.error, { status: 409 });
  }
  const entries = await listZipEntries(selection.roots);
  // One "downloaded" per selected item, as if each was downloaded alone.
  for (const item of selection.items) {
    const files = item.type === "folder" ? (await zipSummary(item.id)).files : undefined;
    await recordActivity({
      itemId: item.id,
      actorId: session.user.id,
      action: "downloaded",
      metadata: files === undefined ? {} : { files },
    });
  }

  async function* zipEntries() {
    for (const entry of entries) {
      if (entry.type === "folder") {
        yield { name: `${entry.path}/`, lastModified: entry.updatedAt };
      } else {
        yield {
          name: entry.path,
          lastModified: entry.updatedAt,
          input: await getObjectStream(itemKey(entry.id)),
        };
      }
    }
  }

  return new Response(downloadZip(zipEntries()).body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(
        "attachment",
        selectionZipName(selection.items.length),
      ),
      "Cache-Control": "no-store",
    },
  });
};
