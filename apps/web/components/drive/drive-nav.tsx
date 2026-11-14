"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, HardDrive, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { getUnreadCount } from "@/app/drive/notification-actions";
import { Button } from "@/components/ui/button";
import { unreadQueryKey } from "@/lib/query-keys";

const LINKS = [
  { href: "/drive", label: "My Drive", icon: HardDrive },
  { href: "/drive/shared", label: "Shared with me", icon: Users },
  { href: "/drive/notifications", label: "Notifications", icon: Bell },
  { href: "/drive/trash", label: "Trash", icon: Trash2 },
] as const;

// The unread count next to Notifications. Realtime refreshes it the moment
// a new one arrives (RealtimeProvider).
const UnreadBadge = () => {
  const { data: unread = 0 } = useQuery({
    queryKey: unreadQueryKey,
    queryFn: () => getUnreadCount(),
  });
  if (unread === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
      {unread}
      <span className="sr-only"> unread</span>
    </span>
  );
};

// My Drive is active on /drive and inside folders (shared ones too: the URL
// doesn't say whose folder it is; the breadcrumbs do); the others on their
// own pages.
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
              {href === "/drive/notifications" && <UnreadBadge />}
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
