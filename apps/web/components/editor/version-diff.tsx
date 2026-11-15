"use client";

import { useEffect, useRef } from "react";
import monaco from "./monaco";

type VersionDiffProps = {
  // editorPath(): the language comes from its extension.
  path: string;
  original: string;
  modified: string;
};

// Two texts side by side, changes highlighted (Monaco's diff editor),
// read-only. Like the live editor, it lives exactly as long as its effect,
// so a page Next hides doesn't keep a disposed editor around.
const VersionDiff = ({ path, original, modified }: VersionDiffProps) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const left = monaco.editor.createModel(original, undefined, monaco.Uri.file(`diff-a/${path}`));
    const right = monaco.editor.createModel(modified, undefined, monaco.Uri.file(`diff-b/${path}`));
    const diff = monaco.editor.createDiffEditor(container.current, {
      readOnly: true,
      originalEditable: false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      // Side by side when there's room (Monaco's default needs 900 px,
      // more than the history dialog has), one column on narrow screens.
      useInlineViewWhenSpaceIsLimited: true,
      renderSideBySideInlineBreakpoint: 600,
    });
    diff.setModel({ original: left, modified: right });
    return () => {
      diff.dispose();
      left.dispose();
      right.dispose();
    };
  }, [path, original, modified]);

  return <div ref={container} className="h-full" />;
};

export default VersionDiff;
