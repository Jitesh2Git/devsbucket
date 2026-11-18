import { recordActivity } from "@devsbucket/db/activity";
import { getOpsThisMonth } from "@devsbucket/db/usage";
import { listZipEntries, zipSummary } from "@devsbucket/db/zip";
import { zipLimitError } from "@devsbucket/shared/limits";
import { contentDisposition } from "@devsbucket/shared/preview";
import { getObjectStream, itemKey } from "@devsbucket/storage/objects";
import { downloadZip } from "client-zip";
import { auth } from "@/lib/auth";
import { resolveItem } from "@/lib/items";

// GET /api/items/<id>/zip: a folder as one ZIP (Phase 5, decision 0017),
// for anyone who may download it. The browser asks checkZip first, so a
// refusal here is only for a request made by hand (or a folder that grew
// in between). Streamed: each file is read from storage while the ZIP is
// being sent, one at a time, never held whole in memory. Not compressed
// (client-zip stores files as they are): deflate would cost the server's
// CPU many times over, and the bandwidth is free.
export const GET = async (
  request: Request,
  { params }: RouteContext<"/api/items/[itemId]/zip">,
) => {
  const [{ itemId }, session] = await Promise.all([
    params,
    auth.api.getSession({ headers: request.headers }),
  ]);
  if (!session) {
    return new Response("Not found", { status: 404 });
  }
  const found = await resolveItem(session.user, itemId, "download", {
    type: "folder",
    trashed: false,
  });
  if (found.denied) {
    return new Response("Not found", { status: 404 });
  }
  const folder = found.item;
  const [summary, ops] = await Promise.all([zipSummary(folder.id), getOpsThisMonth()]);
  const refused = zipLimitError({ ...summary, ops });
  if (refused) {
    return new Response(refused, { status: 409 });
  }
  const entries = await listZipEntries(folder.id);
  await recordActivity({
    itemId: folder.id,
    actorId: session.user.id,
    action: "downloaded",
    metadata: { files: summary.files },
  });

  // Everything sits in a folder named like the one downloaded. Read lazily:
  // client-zip asks for the next entry only when the previous one is sent.
  async function* zipEntries() {
    yield { name: `${folder.name}/`, lastModified: folder.updatedAt };
    for (const entry of entries) {
      const name = `${folder.name}/${entry.path}`;
      if (entry.type === "folder") {
        yield { name: `${name}/`, lastModified: entry.updatedAt };
      } else {
        yield {
          name,
          lastModified: entry.updatedAt,
          input: await getObjectStream(itemKey(entry.id)),
        };
      }
    }
  }

  return new Response(downloadZip(zipEntries()).body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition("attachment", `${folder.name}.zip`),
      "Cache-Control": "no-store",
    },
  });
};
