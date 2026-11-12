"use client";

import { HardDrive, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/drive", label: "My Drive", icon: HardDrive },
  { href: "/drive/trash", label: "Trash", icon: Trash2 },
] as const;

// My Drive is active on /drive and inside its folders; Trash on /drive/trash.
const isActive = (href: string, pathname: string | null) =>
  pathname !== null &&
  (href === "/drive"
    ? pathname === "/drive" || pathname.startsWith("/drive/folders")
    : pathname.startsWith(href));

const NavLinks = ({ pathname }: { pathname: string | null }) => {
  return (
    <nav aria-label="Drive" className="flex gap-1 md:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Button
            key={href}
            asChild
            variant={active ? "secondary" : "ghost"}
            className="justify-start"
          >
            <Link href={href} aria-current={active ? "page" : undefined}>
              <Icon />
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
};

const ActiveNavLinks = () => {
  return <NavLinks pathname={usePathname()} />;
};

// On a page with a dynamic URL (/drive/folders/[folderId]) the path is only
// known per request, so the links are prerendered without a highlight and
// the highlighted version streams in (Cache Components).
const DriveNav = () => {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNavLinks />
    </Suspense>
  );
};

export default DriveNav;
