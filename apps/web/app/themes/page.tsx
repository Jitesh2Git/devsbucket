import type { Metadata } from "next";
import { Suspense } from "react";
import PageLoader from "@/components/page-loader";
import ThemePicker from "@/components/themes/theme-picker";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Themes" };

// Signed-in only, like the profile (proxy.ts redirects early; this checks).
const ThemesContent = async () => {
  await requireSession();
  return <ThemePicker />;
};

const ThemesPage = () => {
  return (
    // At least the screen below the header (h-14), so the loader sits in the
    // middle like on the drive pages.
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-7xl flex-col px-4 py-10">
      <Suspense fallback={<PageLoader />}>
        <ThemesContent />
      </Suspense>
    </div>
  );
};

export default ThemesPage;
