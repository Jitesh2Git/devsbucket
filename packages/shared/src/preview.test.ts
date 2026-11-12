import { describe, expect, it } from "vitest";
import { contentDisposition, inlineContentType, looksLikeText, previewKind } from "./preview.ts";

describe("previewKind", () => {
  it("shows images, video, audio and PDFs inline", () => {
    expect(previewKind("photo.JPG", null)).toBe("image");
    expect(previewKind("clip.mp4", "video/mp4")).toBe("video");
    expect(previewKind("song.m4a", null)).toBe("audio");
    expect(previewKind("paper.pdf", null)).toBe("pdf");
  });

  it("shows code and config as text", () => {
    expect(previewKind("app.tsx", null)).toBe("text");
    expect(previewKind(".gitignore", null)).toBe("text");
    expect(previewKind(".env", null)).toBe("text");
    expect(previewKind("Dockerfile", null)).toBe("text");
    expect(previewKind("notes", "text/plain")).toBe("text");
  });

  it("shows SVG and HTML as text, never rendered", () => {
    expect(previewKind("logo.svg", "image/svg+xml")).toBe("text");
    expect(previewKind("index.html", "text/html")).toBe("text");
    expect(inlineContentType("logo.svg")).toBeNull();
    expect(inlineContentType("index.html")).toBeNull();
  });

  it("ignores the type the browser claimed for media", () => {
    // An HTML page uploaded as "image/png" is still not an image.
    expect(previewKind("page.html", "image/png")).toBe("text");
    expect(inlineContentType("evil.png.html")).toBeNull();
  });

  it("has no preview for archives and binaries", () => {
    expect(previewKind("site.zip", "application/zip")).toBeNull();
    expect(previewKind("tool.exe", null)).toBeNull();
  });
});

describe("inlineContentType", () => {
  it("serves media as a type we chose", () => {
    expect(inlineContentType("a.jpeg")).toBe("image/jpeg");
    expect(inlineContentType("b.PDF")).toBe("application/pdf");
  });
});

describe("looksLikeText", () => {
  it("spots binary content by its NUL bytes", () => {
    const code = Uint8Array.from("const a = 1;\n", (char) => char.charCodeAt(0));
    expect(looksLikeText(code)).toBe(true);
    expect(looksLikeText(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]))).toBe(false);
  });
});

describe("contentDisposition", () => {
  it("keeps plain names as they are", () => {
    expect(contentDisposition("attachment", "notes.md")).toBe(
      "attachment; filename=\"notes.md\"; filename*=UTF-8''notes.md",
    );
  });

  it("encodes names that aren't plain ASCII", () => {
    expect(contentDisposition("inline", "résumé (1).pdf")).toBe(
      "inline; filename=\"r_sum_ (1).pdf\"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%281%29.pdf",
    );
  });

  it("can't be broken by quotes or new lines", () => {
    const header = contentDisposition("attachment", 'a"b\\c\r\nd.txt');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.startsWith('attachment; filename="a_b_c__d.txt"')).toBe(true);
  });
});
