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

// Versions (decisions 0015, 0016): the newest 5 automatic ones per file are
// kept, with version 1 and every named and restore version.
export const MAX_AUTO_VERSIONS = 5;

// Browser → realtime, as Hocuspocus stateless messages: save the live text
// as a named version, or bring an old version back for everyone.
export const collabRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("save-version"),
    message: z
      .string()
      .trim()
      .min(1, "Write what changed")
      .max(200, "Keep it under 200 characters"),
  }),
  z.object({ type: z.literal("restore-version"), versionId: itemIdSchema }),
]);

export type CollabRequest = z.infer<typeof collabRequestSchema>;

// The "Save version" form.
export const versionMessageFormSchema = z.object({
  message: collabRequestSchema.options[0].shape.message,
});

export const versionRefSchema = z.object({ itemId: itemIdSchema, versionId: itemIdSchema });

export type VersionMessageFormInput = z.infer<typeof versionMessageFormSchema>;

// Realtime → browser: the answer to a save or a restore, and "the versions
// changed" to everyone with the file open (an open history panel refetches).
export type CollabReply =
  | { type: "version-saved"; number: number }
  | { type: "version-restored"; number: number; from: number }
  | { type: "version-unchanged"; number: number }
  | { type: "version-error"; error: string }
  | { type: "versions-changed" };

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

// Markdown files get a live preview next to the editor (decision 0003).
export const isMarkdownName = (name: string) => /\.(md|markdown)$/i.test(name);
