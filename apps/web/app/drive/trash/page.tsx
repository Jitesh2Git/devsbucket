import { listTrash } from "@devsbucket/db/trash";
import { trashDaysLeft } from "@devsbucket/shared/limits";
import type { Metadata } from "next";
import { Suspense } from "react";
import TrashList from "@/components/drive/trash-list";
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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
      <Suspense>
        <TrashContent />
      </Suspense>
    </div>
  );
};

export default TrashPage;
