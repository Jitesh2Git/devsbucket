import { describe, expect, it } from "vitest";
import {
  createTextFileSchema,
  cursorColor,
  decodeEditableText,
  editorPath,
  isEditableName,
  isMarkdownName,
} from "./editing.ts";

const bytes = (...values: number[]) => new Uint8Array(values);
const utf8 = (text: string) => new TextEncoder().encode(text);

describe("isEditableName", () => {
  it("allows the text files previews show as text", () => {
    expect(isEditableName("app.ts", null)).toBe(true);
    expect(isEditableName("README.md", null)).toBe(true);
    expect(isEditableName("Dockerfile", null)).toBe(true);
    expect(isEditableName("notes", "text/plain")).toBe(true);
  });

  it("refuses media and unknown files", () => {
    expect(isEditableName("photo.png", "image/png")).toBe(false);
    expect(isEditableName("archive.zip", null)).toBe(false);
  });
});

describe("decodeEditableText", () => {
  it("decodes UTF-8, including non-ASCII", () => {
    expect(decodeEditableText(utf8("héllo ✓"))).toBe("héllo ✓");
    expect(decodeEditableText(bytes())).toBe("");
  });

  it("drops a byte order mark", () => {
    expect(decodeEditableText(bytes(0xef, 0xbb, 0xbf, 0x68, 0x69))).toBe("hi");
  });

  it("refuses bytes that aren't UTF-8 text", () => {
    expect(decodeEditableText(bytes(0x68, 0x00, 0x69))).toBeNull();
    // Latin-1 "é", not valid UTF-8.
    expect(decodeEditableText(bytes(0x63, 0x61, 0x66, 0xe9))).toBeNull();
  });
});

describe("editorPath", () => {
  it("keeps the name last, so the extension picks the language", () => {
    expect(editorPath("abc", "app.ts")).toBe("abc/app.ts");
  });
});

describe("createTextFileSchema", () => {
  const parse = (name: string) => createTextFileSchema.safeParse({ parentId: null, name });

  it("takes text file names, trimmed", () => {
    expect(parse("  notes.md ").data?.name).toBe("notes.md");
    expect(parse("Dockerfile").success).toBe(true);
    expect(parse(".env").success).toBe(true);
  });

  it("refuses names the editor can't open", () => {
    expect(parse("photo.png").error?.issues[0]?.message).toBe(
      "Use a text or code file extension, like .md, .ts or .py",
    );
    expect(parse("notes").success).toBe(false);
    expect(parse("").success).toBe(false);
  });
});

describe("cursorColor", () => {
  it("is the same for the same person, and a hex color", () => {
    const id = "01a1df50-716b-7ea9-8ec9-97bb07d2ac31";
    expect(cursorColor(id)).toBe(cursorColor(id));
    expect(cursorColor(id)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("spreads people over several colors", () => {
    const colors = new Set(Array.from({ length: 40 }, (_, i) => cursorColor(`user-${i}`)));
    expect(colors.size).toBeGreaterThan(4);
  });
});

describe("isMarkdownName", () => {
  it("is true for .md and .markdown, in any case", () => {
    expect(isMarkdownName("README.md")).toBe(true);
    expect(isMarkdownName("notes.MARKDOWN")).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isMarkdownName("app.ts")).toBe(false);
    expect(isMarkdownName("md")).toBe(false);
    expect(isMarkdownName("page.mdx")).toBe(false);
  });
});
