import { describe, expect, it } from "vitest";
import { decodeEditableText, editorPath, isEditableName } from "./editing.ts";

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
