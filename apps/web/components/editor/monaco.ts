import * as monaco from "monaco-editor";

// Monaco from our own bundle (no CDN), set up once. y-monaco (step 5)
// imports `monaco-editor` too, so both use this same copy. Browser only:
// import it through CodeEditorLazy.

// Language services run in web workers, one per kind. Each file is only
// downloaded when a model of that language opens.
self.MonacoEnvironment = {
  getWorker: (_workerId: string, label: string) => {
    switch (label) {
      case "json":
        return new Worker(new URL("monaco-editor/language/json/json.worker", import.meta.url), {
          type: "module",
        });
      case "css":
      case "scss":
      case "less":
        return new Worker(new URL("monaco-editor/language/css/css.worker", import.meta.url), {
          type: "module",
        });
      case "html":
      case "handlebars":
      case "razor":
        return new Worker(new URL("monaco-editor/language/html/html.worker", import.meta.url), {
          type: "module",
        });
      case "typescript":
      case "javascript":
        return new Worker(new URL("monaco-editor/language/typescript/ts.worker", import.meta.url), {
          type: "module",
        });
      default:
        return new Worker(new URL("monaco-editor/editor/editor.worker", import.meta.url), {
          type: "module",
        });
    }
  },
};

// A file in the drive has no project around it, so "Cannot find name" and
// unresolved imports would underline half of it. Keep syntax errors only.
for (const defaults of [
  monaco.typescript.typescriptDefaults,
  monaco.typescript.javascriptDefaults,
]) {
  defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
}

export default monaco;
