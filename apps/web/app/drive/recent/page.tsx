import { listRecent } from "@devsbucket/db/recent";
import type { Metadata } from "next";
import { Suspense } from "react";
import RecentList from "@/components/drive/recent-list";
import ViewToggle from "@/components/drive/view-toggle";
import PageLoader from "@/components/page-loader";
import { SelectionProvider, SelectionSlot } from "@/lib/selection";
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
    // One selection for the list and the bar in the header (multi-select).
    <SelectionProvider>
      <div className="flex flex-col gap-4 md:h-full">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">Recent</h1>
          <div className="flex items-center gap-2">
            <ViewToggle />
            <SelectionSlot />
          </div>
        </div>
        <Suspense fallback={<PageLoader />}>
          <RecentContent />
        </Suspense>
      </div>
    </SelectionProvider>
  );
};

export default RecentPage;
