import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIME_TYPE,
  itemNameSchema,
  listItemsSchema,
  MAX_NAME_LENGTH,
  mimeTypeSchema,
  nextAvailableName,
  requestUploadSchema,
} from "./item.ts";

describe("itemNameSchema", () => {
  it("trims", () => {
    expect(itemNameSchema.parse("  notes.md  ")).toBe("notes.md");
  });

  it("normalizes to NFC", () => {
    // "e" + combining acute accent becomes the single character "é".
    expect(itemNameSchema.parse("cafe\u0301")).toBe("caf\u00e9");
  });

  it.each([
    ["", "empty"],
    ["   ", "only spaces"],
    ["a".repeat(MAX_NAME_LENGTH + 1), "too long"],
    ["src/app", "has a slash"],
    ["bad\u0000name", "has a NUL"],
    ["tab\there", "has a tab"],
    [".", "is ."],
    ["..", "is .."],
  ])("rejects %j (%s)", (input) => {
    expect(itemNameSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    "notes.md",
    ".env",
    "...",
    "My Folder",
    "a".repeat(MAX_NAME_LENGTH),
    "日本語.txt",
    "back\\slash",
  ])("accepts %j", (input) => {
    expect(itemNameSchema.safeParse(input).success).toBe(true);
  });
});

describe("nextAvailableName", () => {
  const file = { keepExtension: true };
  const folder = { keepExtension: false };

  it("keeps a free name", () => {
    expect(nextAvailableName("notes.md", ["other.md"], file)).toBe("notes.md");
  });

  it("numbers files before the extension", () => {
    expect(nextAvailableName("notes.md", ["notes.md"], file)).toBe("notes (1).md");
    expect(nextAvailableName("notes.md", ["notes.md", "notes (1).md"], file)).toBe("notes (2).md");
  });

  it("ignores case, like the database", () => {
    expect(nextAvailableName("Notes.md", ["notes.MD", "NOTES (1).md"], file)).toBe("Notes (2).md");
  });

  it("only keeps the last extension apart", () => {
    expect(nextAvailableName("archive.tar.gz", ["archive.tar.gz"], file)).toBe(
      "archive.tar (1).gz",
    );
  });

  it("treats dotfiles and extensionless files as having no extension", () => {
    expect(nextAvailableName(".env", [".env"], file)).toBe(".env (1)");
    expect(nextAvailableName("Makefile", ["Makefile"], file)).toBe("Makefile (1)");
  });

  it("numbers folders at the end, dots and all", () => {
    expect(nextAvailableName("src", ["src"], folder)).toBe("src (1)");
    expect(nextAvailableName("v1.2", ["v1.2"], folder)).toBe("v1.2 (1)");
  });

  it("stays within the length limit", () => {
    const long = `${"a".repeat(MAX_NAME_LENGTH - 3)}.md`;
    const next = nextAvailableName(long, [long], file);
    expect(next).toHaveLength(MAX_NAME_LENGTH);
    expect(next.endsWith(" (1).md")).toBe(true);
  });
});

describe("listItemsSchema", () => {
  const id = "019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7b";

  it("accepts the first page and a cursor", () => {
    expect(listItemsSchema.safeParse({ parentId: null, cursor: null }).success).toBe(true);
    const cursor = { notFolder: true, sortName: "notes.md", id };
    expect(listItemsSchema.safeParse({ parentId: id, cursor }).success).toBe(true);
  });

  it.each([
    ["a bad parent id", { parentId: "1", cursor: null }],
    ["a bad cursor id", { parentId: null, cursor: { notFolder: true, sortName: "a", id: "x" } }],
    ["a cursor missing fields", { parentId: null, cursor: { id } }],
  ])("rejects %s", (_label, input) => {
    expect(listItemsSchema.safeParse(input).success).toBe(false);
  });
});

describe("mimeTypeSchema", () => {
  it("keeps a plain type, lowercased", () => {
    expect(mimeTypeSchema.parse("text/plain")).toBe("text/plain");
    expect(mimeTypeSchema.parse("Image/PNG")).toBe("image/png");
    expect(mimeTypeSchema.parse("application/vnd.ms-excel")).toBe("application/vnd.ms-excel");
  });

  it("falls back to application/octet-stream for anything else", () => {
    expect(mimeTypeSchema.parse("")).toBe(DEFAULT_MIME_TYPE);
    expect(mimeTypeSchema.parse("text/plain; charset=utf-8")).toBe(DEFAULT_MIME_TYPE);
    expect(mimeTypeSchema.parse("text/html\r\nX-Evil: 1")).toBe(DEFAULT_MIME_TYPE);
    expect(mimeTypeSchema.parse("nonsense")).toBe(DEFAULT_MIME_TYPE);
  });
});

describe("requestUploadSchema", () => {
  const valid = { parentId: null, name: "notes.md", size: 12, mimeType: "text/markdown" };

  it("accepts a file, including an empty one", () => {
    expect(requestUploadSchema.safeParse(valid).success).toBe(true);
    expect(requestUploadSchema.safeParse({ ...valid, size: 0 }).success).toBe(true);
  });

  it("refuses sizes that aren't a byte count", () => {
    expect(requestUploadSchema.safeParse({ ...valid, size: -1 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...valid, size: 1.5 }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...valid, size: "12" }).success).toBe(false);
  });

  it("applies the name rules", () => {
    expect(requestUploadSchema.safeParse({ ...valid, name: ".." }).success).toBe(false);
  });
});
