import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = { title: "Link unavailable" };

// Where /s/<token> sends a wrong, disabled or expired link. It never says
// which, or what the link was for.
const LinkUnavailablePage = () => {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Link2Off />
          </EmptyMedia>
          <EmptyTitle>This link no longer works</EmptyTitle>
          <EmptyDescription>
            It may have been turned off or expired. Ask the person who shared it for a new one.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/drive">Go to My Drive</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

export default LinkUnavailablePage;
