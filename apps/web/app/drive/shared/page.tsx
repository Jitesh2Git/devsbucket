import { listSharedWithMe } from "@devsbucket/db/shared-with-me";
import { listOffersTo } from "@devsbucket/db/transfers";
import type { Metadata } from "next";
import { Suspense } from "react";
import SharedList from "@/components/drive/shared-list";
import ViewToggle from "@/components/drive/view-toggle";
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
  const [items, offers, found] = await Promise.all([
    listSharedWithMe(user.id),
    listOffersTo(user.id),
    typeof file === "string" ? resolveFile(user, file, "view") : null,
  ]);
  const opened = found && !found.denied ? found.item : null;
  return (
    <SharedList
      // A new file to open starts a fresh list, with its preview open.
      key={opened?.id ?? "list"}
      items={items}
      offers={offers}
      opened={
        opened && { id: opened.id, name: opened.name, mimeType: opened.mimeType, size: opened.size }
      }
    />
  );
};

const SharedPage = ({ searchParams }: PageProps<"/drive/shared">) => {
  return (
    // From md up the page fills the drive column and only the list scrolls.
    <div className="flex flex-col gap-4 md:h-full">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">Shared with me</h1>
        <ViewToggle />
      </div>
      <Suspense>
        <SharedContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
};

export default SharedPage;
