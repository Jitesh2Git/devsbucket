import { splitExtension } from "./item.ts";

// What the preview dialog can show (step 8). Decided by the file's
// extension, which we control, never by the type the browser sent at upload.
export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text";

// Media we let the browser show inline, with the Content-Type we serve it
// as. Not SVG (it can run scripts) and not HTML: those are shown as text.
const INLINE_TYPES: Record<string, { kind: Exclude<PreviewKind, "text">; type: string }> = {
  ".png": { kind: "image", type: "image/png" },
  ".jpg": { kind: "image", type: "image/jpeg" },
  ".jpeg": { kind: "image", type: "image/jpeg" },
  ".gif": { kind: "image", type: "image/gif" },
  ".webp": { kind: "image", type: "image/webp" },
  ".avif": { kind: "image", type: "image/avif" },
  ".mp4": { kind: "video", type: "video/mp4" },
  ".webm": { kind: "video", type: "video/webm" },
  ".mp3": { kind: "audio", type: "audio/mpeg" },
  ".m4a": { kind: "audio", type: "audio/mp4" },
  ".wav": { kind: "audio", type: "audio/wav" },
  ".ogg": { kind: "audio", type: "audio/ogg" },
  ".flac": { kind: "audio", type: "audio/flac" },
  ".pdf": { kind: "pdf", type: "application/pdf" },
};

// Text files a developer drive meets every day. Anything else with a text/*
// type counts too; the server still checks the content has no NUL bytes.
const TEXT_EXTENSIONS = new Set(
  [
    "txt md markdown csv tsv log json jsonc yaml yml toml ini cfg conf env xml svg html htm css scss",
    "js mjs cjs jsx ts mts cts tsx vue svelte astro py rb php java kt kts go rs c h cpp hpp cc cs",
    "swift m sh bash zsh fish ps1 bat sql graphql gql prisma proto dockerfile makefile gitignore",
    "editorconfig lock tex rst diff patch",
  ]
    .join(" ")
    .split(" ")
    .map((ext) => `.${ext}`),
);

// Files with no extension that are text by name.
const TEXT_NAMES = new Set(["dockerfile", "makefile", "license", "readme", "procfile"]);

const extensionOf = (name: string) => {
  const lower = name.toLowerCase();
  const [base, extension] = splitExtension(lower);
  // ".gitignore", ".env": a leading dot is the whole name, not an extension.
  if (!extension && base.startsWith(".")) {
    return base;
  }
  return extension;
};

export const previewKind = (name: string, mimeType: string | null): PreviewKind | null => {
  const extension = extensionOf(name);
  const inline = INLINE_TYPES[extension];
  if (inline) {
    return inline.kind;
  }
  if (
    TEXT_EXTENSIONS.has(extension) ||
    TEXT_NAMES.has(name.toLowerCase()) ||
    mimeType?.startsWith("text/")
  ) {
    return "text";
  }
  return null;
};

// The Content-Type to serve an inline preview as, or null when the file
// must never be shown inline.
export const inlineContentType = (name: string) => INLINE_TYPES[extensionOf(name)]?.type ?? null;

// The first megabyte is enough to read; the rest is a download away.
export const TEXT_PREVIEW_BYTES = 1024 * 1024;

// Binary files almost always contain a NUL byte early on; text never does.
export const looksLikeText = (bytes: Uint8Array) => !bytes.includes(0);

// A Content-Disposition header that keeps any file name intact: a plain
// ASCII fallback for old clients, and the real name UTF-8 encoded
// (RFC 6266 / RFC 5987) for everyone else.
export const contentDisposition = (kind: "inline" | "attachment", name: string) => {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};
