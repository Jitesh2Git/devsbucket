import { previewKind } from "./preview.ts";

// Live editing (Phase 4, decision 0013). A file opens in the editor when
// its name says text (the same list as previews) and its bytes are UTF-8
// without NUL bytes. There's no size limit.

export const isEditableName = (name: string, mimeType: string | null) =>
  previewKind(name, mimeType) === "text";

// The file's text, or null when the bytes aren't UTF-8 text. A leading
// byte order mark is dropped (TextDecoder's default).
export const decodeEditableText = (bytes: Uint8Array): string | null => {
  if (bytes.includes(0)) {
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
};

// The editor model's path: the id keeps two files with the same name
// apart, and the name lets Monaco pick the language from the extension.
export const editorPath = (fileId: string, name: string) => `${fileId}/${name}`;
