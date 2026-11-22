import { Suspense } from "react";
import DriveNav from "@/components/drive/drive-nav";
import SearchPalette from "@/components/drive/search-palette";
import StorageMeter from "@/components/drive/storage-meter";
import UploadsPanel from "@/components/drive/uploads-panel";
import UploadsProvider from "@/components/drive/uploads-provider";
import RealtimeProvider from "@/components/realtime-provider";

const DriveLayout = ({ children }: LayoutProps<"/drive">) => {
  return (
    // Uploads and the live connection live here, above the pages, so they
    // keep going between folders.
    // From md up the drive fills the window below the header (h-14 = 3.5rem)
    // and the page never scrolls: the sidebar stays put, and long content
    // scrolls inside the right column (folder pages scroll only their list).
    // On phones the whole page scrolls as usual.
    <RealtimeProvider>
      <UploadsProvider>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:h-[calc(100dvh-3.5rem)] md:flex-row">
          <aside
            // Its colours follow the theme's sidebar option (globals.css).
            data-slot="drive-sidebar"
            className="flex min-w-0 shrink-0 flex-col gap-6 md:w-56 md:overflow-y-auto"
          >
            <SearchPalette />
            <DriveNav />
            {/* Same height as the meter, so the sidebar doesn't jump while it loads. */}
            <Suspense fallback={<div className="h-7" />}>
              <StorageMeter />
            </Suspense>
          </aside>
          <div className="min-w-0 flex-1 md:min-h-0 md:overflow-y-auto">{children}</div>
        </div>
        <UploadsPanel />
      </UploadsProvider>
    </RealtimeProvider>
  );
};

export default DriveLayout;
