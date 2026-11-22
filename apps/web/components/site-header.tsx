import Link from "next/link";
import { Suspense } from "react";
import ModeToggle from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";

// Stays at the top while the page scrolls (sticky), above the content but
// below dialogs, menus and toasts (z-50 and up). Slightly see-through with a
// blur where the browser supports it, solid otherwise.
const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-40 border-b bg-background supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          DevsBucket
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
          {/* Same size as the avatar, so the header doesn't jump while it loads. */}
          <Suspense fallback={<div className="size-8" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
