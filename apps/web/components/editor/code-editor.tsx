"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import monaco from "./monaco";

type CodeEditorProps = {
  // editorPath(): the language comes from its extension.
  path: string;
  value: string;
  readOnly: boolean;
};

// The Monaco editor itself. Imported only through CodeEditorLazy, so
// Monaco never runs on the server or ships with other pages.
//
// The editor lives exactly as long as the effect: Next 16 keeps pages you
// leave alive but hidden (React Activity), which runs effect cleanups on
// hide and the effects again on show. Disposing here and creating a fresh
// editor on show is the only safe way; keeping a disposed one around (as
// @monaco-editor/react does) throws "InstantiationService has been disposed".
const CodeEditor = ({ path, value, readOnly }: CodeEditorProps) => {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  useEffect(() => {
    if (!container.current) {
      return;
    }
    // No language given: Monaco picks it from the path's extension.
    const model = monaco.editor.createModel(value, undefined, monaco.Uri.file(path));
    const editor = monaco.editor.create(container.current, {
      model,
      readOnly,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 13,
    });
    return () => {
      editor.dispose();
      model.dispose();
    };
  }, [path, value, readOnly]);

  // The theme is global to Monaco, so it changes without a new editor.
  useEffect(() => {
    monaco.editor.setTheme(theme);
  }, [theme]);

  return <div ref={container} className="h-full" />;
};

export default CodeEditor;
