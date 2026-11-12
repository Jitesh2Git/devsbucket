import { z } from "zod";

export const MAX_NAME_LENGTH = 255;

// Control characters (U+0000–U+001F and U+007F) can't be typed and break
// file names in shells and ZIP files.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

// A file or folder name (decision 0007). Trimmed, and NFC-normalized so "é"
// typed two different ways counts as the same name.
export const itemNameSchema = z
  .string()
  .trim()
  .normalize("NFC")
  .min(1, "Enter a name")
  .max(MAX_NAME_LENGTH, `Names can be up to ${MAX_NAME_LENGTH} characters`)
  .refine((name) => !name.includes("/"), 'Names can\'t contain "/"')
  .refine((name) => !CONTROL_CHARACTERS.test(name), "Names can't contain control characters")
  .refine((name) => name !== "." && name !== "..", 'Names can\'t be "." or ".."');

// Item ids are uuids; anything else (a typo in a URL) can't be an item.
export const itemIdSchema = z.uuid();

export const createFolderSchema = z.object({
  // null = the top level of My Drive.
  parentId: itemIdSchema.nullable(),
  name: itemNameSchema,
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;

// The form in the New folder dialog (and, in step 9, the Rename dialog).
export const nameFormSchema = z.object({ name: itemNameSchema });

export type NameFormInput = z.infer<typeof nameFormSchema>;

// Where the next page of a folder listing starts: the sort key of the last
// row shown (keyset pagination). It comes back from the browser, so the
// server validates it like any other input.
export const cursorSchema = z.object({
  // false for folders, true for everything else: folders come first
  notFolder: z.boolean(),
  // lower(name), exactly as Postgres computed it
  sortName: z.string(),
  id: itemIdSchema,
});

export type Cursor = z.infer<typeof cursorSchema>;

export const listItemsSchema = z.object({
  parentId: itemIdSchema.nullable(),
  cursor: cursorSchema.nullable(),
});

export type ListItemsInput = z.infer<typeof listItemsSchema>;

// The message for a name that's already used in a folder (decision 0007).
export const nameTakenMessage = (name: string) =>
  `A file or folder named "${name}" already exists here.`;

// Splits "notes.md" into ["notes", ".md"]. Only the last extension counts
// ("archive.tar.gz" -> ["archive.tar", ".gz"]), and a leading dot isn't one
// (".env" -> [".env", ""]).
export const splitExtension = (name: string): [string, string] => {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return [name, ""];
  }
  return [name.slice(0, dot), name.slice(dot)];
};

// The first free name in a folder, for uploads and restores (decision 0007):
// "notes.md" -> "notes (1).md" -> "notes (2).md"; folders: "src" -> "src (1)".
// `taken` is every name already in the folder; case doesn't matter, like the
// database's unique index. The index stays the final judge on a race.
export const nextAvailableName = (
  name: string,
  taken: Iterable<string>,
  { keepExtension }: { keepExtension: boolean },
): string => {
  const used = new Set(Array.from(taken, (n) => n.toLowerCase()));
  if (!used.has(name.toLowerCase())) {
    return name;
  }
  const [base, extension] = keepExtension ? splitExtension(name) : [name, ""];
  for (let n = 1; ; n += 1) {
    const suffix = ` (${n})${extension}`;
    // Shorten the base if the suffix would push the name past the limit.
    const candidate = base.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
};

// What the browser says about a file it wants to upload. The type is only a
// label for later (previews choose from their own allowlist): anything that
// isn't a plain "type/subtype" becomes application/octet-stream.
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
export const DEFAULT_MIME_TYPE = "application/octet-stream";

export const mimeTypeSchema = z
  .string()
  .transform((type) => type.trim().toLowerCase())
  .transform((type) => (type.length <= 255 && MIME_TYPE.test(type) ? type : DEFAULT_MIME_TYPE));

export const requestUploadSchema = z.object({
  parentId: itemIdSchema.nullable(),
  name: itemNameSchema,
  // The size limit itself is checked with the other limits (shared/limits).
  size: z.int().nonnegative(),
  mimeType: mimeTypeSchema,
});

export const uploadIdSchema = z.object({ itemId: itemIdSchema });

// After the browser's PUTs. A multipart upload also sends each part's ETag,
// in order (storage checks them when it joins the parts).
export const completeUploadSchema = z.object({
  itemId: itemIdSchema,
  parts: z
    .array(z.object({ partNumber: z.int().min(1).max(10_000), etag: z.string().min(1).max(200) }))
    .max(10_000)
    .optional(),
});

export const renameItemSchema = z.object({ itemId: itemIdSchema, name: itemNameSchema });

export const moveItemSchema = z.object({
  itemId: itemIdSchema,
  // The folder to move into; null = the top level of My Drive.
  parentId: itemIdSchema.nullable(),
});

// The folders inside one folder, for the Move dialog's folder picker.
export const listFoldersSchema = z.object({ parentId: itemIdSchema.nullable() });

// The part of a file name to select when renaming: everything before the
// extension ("notes" in "notes.md"), so typing keeps ".md". Folders: all of it.
export const renameSelection = (name: string, isFolder: boolean) =>
  isFolder ? name.length : splitExtension(name)[0].length;
