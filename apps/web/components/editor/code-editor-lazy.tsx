"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

// Monaco needs the browser (window, web workers): load it there only.
const CodeEditorLazy = dynamic(() => import("@/components/editor/code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
});

export default CodeEditorLazy;
