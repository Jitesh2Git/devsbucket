import { Suspense } from "react";
import DriveNav from "@/components/drive/drive-nav";
import StorageMeter from "@/components/drive/storage-meter";

const DriveLayout = ({ children }: LayoutProps<"/drive">) => {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 md:w-56">
        <DriveNav />
        {/* Same height as the meter, so the sidebar doesn't jump while it loads. */}
        <Suspense fallback={<div className="h-7" />}>
          <StorageMeter />
        </Suspense>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export default DriveLayout;
