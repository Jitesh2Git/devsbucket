import { listSharedWithMe } from "@devsbucket/db/shared-with-me";
import type { Metadata } from "next";
import { Suspense } from "react";
import SharedList from "@/components/drive/shared-list";
import { resolveFile } from "@/lib/items";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Shared with me" };

// ?file=<id>: a file share link (/s/…) lands here, with the file open in
// the preview, if the user may view it.
const SharedContent = async ({
  searchParams,
}: {
  searchParams: PageProps<"/drive/shared">["searchParams"];
}) => {
  const [{ file }, { user }] = await Promise.all([searchParams, requireSession()]);
  const [items, found] = await Promise.all([
    listSharedWithMe(user.id),
    typeof file === "string" ? resolveFile(user, file, "view") : null,
  ]);
  const opened = found && !found.denied ? found.item : null;
  return (
    <SharedList
      // A new file to open starts a fresh list, with its preview open.
      key={opened?.id ?? "list"}
      items={items}
      opened={
        opened && { id: opened.id, name: opened.name, mimeType: opened.mimeType, size: opened.size }
      }
    />
  );
};

const SharedPage = ({ searchParams }: PageProps<"/drive/shared">) => {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Shared with me</h1>
      <Suspense>
        <SharedContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
};

export default SharedPage;
