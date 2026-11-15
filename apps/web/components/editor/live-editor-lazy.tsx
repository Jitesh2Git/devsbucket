"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

// Monaco and the live connection need the browser: load them there only.
const LiveEditorLazy = dynamic(() => import("@/components/editor/live-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center">
      <Spinner />
    </div>
  ),
});

export default LiveEditorLazy;
