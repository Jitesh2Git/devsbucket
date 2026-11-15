import { z } from "zod";
import { itemIdSchema, itemNameSchema } from "./item.ts";
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

// The name of the shared text in a file's live Yjs document, the same in
// realtime (Hocuspocus) and in the browser (y-monaco, step 5).
export const COLLAB_TEXT = "content";

// Over this size the editor still opens, but only when the person asks:
// a 100 MB file takes ~10 s and ~1 GB in the browser (decision 0014).
export const LARGE_EDIT_BYTES = 10 * 1024 * 1024;

// Why realtime refuses a file's live document. Hocuspocus sends an error's
// `reason` to the browser, which says what happened.
export type CollabRefusal = "no-access" | "not-text";

// Each person's cursor color, the same in every browser and every visit:
// picked from their user id. Readable on light and dark backgrounds.
const CURSOR_COLORS = [
  "#e5484d",
  "#f76b15",
  "#ffc53d",
  "#46a758",
  "#12a594",
  "#0090ff",
  "#6e56cf",
  "#d6409f",
] as const;

export const cursorColor = (userId: string) => {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length] ?? CURSOR_COLORS[0];
};

// The editor model's path: the id keeps two files with the same name
// apart, and the name lets Monaco pick the language from the extension.
export const editorPath = (fileId: string, name: string) => `${fileId}/${name}`;

// A new, empty file made in the app ("New file"): its name must say text,
// or the editor wouldn't open it.
export const textFileNameSchema = itemNameSchema.refine(
  (name) => isEditableName(name, null),
  "Use a text or code file extension, like .md, .ts or .py",
);

export const newFileFormSchema = z.object({ name: textFileNameSchema });

export type NewFileFormInput = z.infer<typeof newFileFormSchema>;

export const createTextFileSchema = z.object({
  // null = the top level of My Drive.
  parentId: itemIdSchema.nullable(),
  name: textFileNameSchema,
});
