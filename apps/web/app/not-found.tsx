import { HardDrive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import GoBackButton from "@/components/go-back-button";
import NotFoundTerminal from "@/components/not-found-terminal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// Every 404: an unknown address, and notFound() (a folder or file that
// doesn't exist, the admin page for non-admins). A terminal fetches the
// address and gets a 404 with somewhere else to go.
const NotFound = () => {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-sm text-primary-text">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      </div>
      <NotFoundTerminal />
      <p className="max-w-md text-muted-foreground">
        This page could not be found. It may have moved, or the link is wrong.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/drive">
            <HardDrive />
            Go to My Drive
          </Link>
        </Button>
        <GoBackButton />
      </div>
    </div>
  );
};

export default NotFound;
