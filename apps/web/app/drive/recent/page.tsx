import { listRecent } from "@devsbucket/db/recent";
import type { Metadata } from "next";
import { Suspense } from "react";
import RecentList from "@/components/drive/recent-list";
import ViewToggle from "@/components/drive/view-toggle";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Recent" };

const RecentContent = async () => {
  const { user } = await requireSession();
  const items = await listRecent(user.id);
  return <RecentList items={items} userId={user.id} />;
};

const RecentPage = () => {
  return (
    // From md up the page fills the drive column and only the list scrolls.
    <div className="flex flex-col gap-4 md:h-full">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">Recent</h1>
        <ViewToggle />
      </div>
      <Suspense>
        <RecentContent />
      </Suspense>
    </div>
  );
};

export default RecentPage;
