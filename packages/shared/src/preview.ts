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

// Text and code files: they preview as text, open in the editor and can be
// made with "New file". To add one, put its extension (lowercase, no dot)
// on a line below; to stop one opening in the editor, remove it. Anything
// else with a text/* type counts too, and the server still checks the
// content is UTF-8 with no NUL bytes, so a binary file never opens as text.
const TEXT_EXTENSIONS = new Set(
  [
    // Notes, docs and data
    "txt md markdown mdx rst adoc tex csv tsv log json jsonc json5 ndjson yaml yml toml ini",
    "cfg conf env properties xml xsd xsl svg plist http srt vtt",
    // Web
    "html htm css scss sass less styl js mjs cjs jsx ts mts cts tsx vue svelte astro",
    "ejs hbs handlebars pug njk twig liquid mustache",
    // Languages
    "py pyi rb php java kt kts scala groovy gradle go rs c h cpp hpp cc cxx cs fs swift m mm",
    "dart lua zig nim r jl ex exs erl hrl hs elm clj cljs edn ml mli pl pm sol asm s",
    // Shell, build and infrastructure
    "sh bash zsh fish ps1 psm1 bat cmd mk cmake dockerfile makefile tf tfvars hcl nix",
    // Queries and schemas
    "sql graphql gql prisma proto",
    // Repo tooling
    "gitignore gitattributes editorconfig lock diff patch mod sum",
  ]
    .join(" ")
    .split(" ")
    .map((ext) => `.${ext}`),
);

// Files with no extension that are text by name (lowercase).
const TEXT_NAMES = new Set([
  "dockerfile",
  "containerfile",
  "makefile",
  "gnumakefile",
  "justfile",
  "procfile",
  "gemfile",
  "rakefile",
  "podfile",
  "brewfile",
  "vagrantfile",
  "jenkinsfile",
  "caddyfile",
  "pipfile",
  "license",
  "licence",
  "readme",
  "changelog",
  "authors",
  "contributing",
  "codeowners",
  "notice",
  "copying",
]);

// Config dotfiles whose last part isn't a known extension: ".env.local",
// ".env.production", and the "rc" and "ignore" files (".prettierrc",
// ".npmrc", ".dockerignore"). Binary ones are still caught by the NUL check.
const isConfigDotfile = (lower: string) =>
  lower.startsWith(".env.") || /^\.[a-z0-9_.-]*(rc|ignore)$/.test(lower);

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
    isConfigDotfile(name.toLowerCase()) ||
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
