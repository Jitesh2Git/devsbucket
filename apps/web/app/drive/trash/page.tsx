import { listTrash } from "@devsbucket/db/trash";
import { trashDaysLeft } from "@devsbucket/shared/limits";
import type { Metadata } from "next";
import { Suspense } from "react";
import TrashList from "@/components/drive/trash-list";
import ViewToggle from "@/components/drive/view-toggle";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Trash" };

const TrashContent = async () => {
  const { user } = await requireSession();
  const items = await listTrash(user.id);
  const now = new Date();
  return (
    <TrashList
      userId={user.id}
      items={items.map((item) => ({
        ...item,
        daysLeft: item.trashedAt ? trashDaysLeft(item.trashedAt, now) : 0,
      }))}
    />
  );
};

const TrashPage = () => {
  return (
    // From md up the page fills the drive column and only the list scrolls.
    <div className="flex flex-col gap-4 md:h-full">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">Trash</h1>
        <ViewToggle />
      </div>
      <Suspense>
        <TrashContent />
      </Suspense>
    </div>
  );
};

export default TrashPage;
