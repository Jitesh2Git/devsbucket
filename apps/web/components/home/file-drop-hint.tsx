"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import LogoMark from "@/components/logo-mark";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

// An easter egg: dragging a file over the homepage shows the bucket
// wobbling and where the file would go, and dropping it doesn't open it in
// the browser (the default) but says how to upload it.
const FileDropHint = ({ signedIn }: { signedIn: boolean }) => {
  const router = useRouter();
  const [over, setOver] = useState(false);

  useEffect(() => {
    // dragenter and dragleave fire for every element crossed; count them.
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setOver(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const overPage = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setOver(false);
      if (signedIn) {
        toast("Nice file. Drop it in My Drive to keep it.", {
          action: { label: "Go to My Drive", onClick: () => router.push("/drive") },
        });
      } else {
        toast("Nice file. Sign in and it goes straight in your bucket.", {
          action: { label: "Sign in", onClick: () => router.push("/sign-in") },
        });
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overPage);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overPage);
      window.removeEventListener("drop", drop);
    };
  }, [signedIn, router]);

  if (!over) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-3xl border-2 border-dashed border-primary bg-background/70 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="home-wobble-loop">
          <LogoMark className="size-20" />
        </span>
        <p className="font-heading text-lg font-semibold">
          {signedIn ? "Drop it in My Drive to keep it" : "Sign in to drop that in the bucket"}
        </p>
        <p className="text-sm text-muted-foreground">
          Your files go in My Drive, up to 100 MB each.
        </p>
      </div>
    </div>
  );
};

export default FileDropHint;
