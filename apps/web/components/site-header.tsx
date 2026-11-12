import Link from "next/link";
import { Suspense } from "react";
import ModeToggle from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";

const SiteHeader = () => {
  return (
    <header className="border-b">
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
