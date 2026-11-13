"use client";

import { LogOut, Shield, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvatar from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";

type UserMenuDropdownProps = {
  name: string;
  email: string;
  image: string | null;
  // Shows the Admin link; the page checks for itself.
  isAdmin: boolean;
};

// Pages proxy.ts only lets signed-out people see.
const SIGNED_OUT_PAGES = ["/", "/sign-in", "/sign-up"];

const UserMenuDropdown = ({ name, email, image, isAdmin }: UserMenuDropdownProps) => {
  const pathname = usePathname();
  const router = useRouter();

  // This menu on a signed-out page means the session ended somewhere else
  // (an admin removed the account, signed it out or reset its password).
  // The header sits in the root layout, which moving between pages doesn't
  // re-render, so ask the server for a fresh one: it shows "Sign in".
  useEffect(() => {
    if (SIGNED_OUT_PAGES.includes(pathname)) {
      router.refresh();
    }
  }, [pathname, router]);

  const signOut = async () => {
    await authClient.signOut();
    // A full page load, not router.push: Next.js keeps visited pages alive in
    // the background (React <Activity>), and their state must not outlive
    // the session (filled-in forms, cached signed-in pages).
    window.location.href = "/sign-in";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <UserAvatar name={name} image={image} className="size-8" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium text-foreground">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield />
              Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenuDropdown;
