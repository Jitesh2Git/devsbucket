import type { Access } from "@devsbucket/shared/access";
import { describe, expect, it } from "vitest";
import { collabMode } from "./mode.ts";

const access = (role: Access["role"]): Access => ({ role, editorsCanShare: true, trashed: false });
const file = {
  type: "file" as const,
  status: "ready" as const,
  trashedAt: null,
  name: "notes.md",
  mimeType: "text/markdown",
};

describe("collabMode", () => {
  it("lets Owners and Editors edit, and Viewers watch", () => {
    expect(collabMode(access("owner"), file, false)).toBe("edit");
    expect(collabMode(access("editor"), file, false)).toBe("edit");
    expect(collabMode(access("viewer"), file, false)).toBe("read-only");
  });

  it("refuses people without access, and missing items", () => {
    expect(collabMode(access(null), file, false)).toBeNull();
    expect(collabMode(null, file, false)).toBeNull();
    expect(collabMode(access("owner"), null, false)).toBeNull();
  });

  it("refuses folders, pending uploads, trashed and non-text files", () => {
    const owner = access("owner");
    expect(collabMode(owner, { ...file, type: "folder" }, false)).toBeNull();
    expect(collabMode(owner, { ...file, status: "pending" }, false)).toBeNull();
    expect(collabMode(owner, { ...file, trashedAt: new Date() }, false)).toBeNull();
    expect(
      collabMode(owner, { ...file, name: "photo.png", mimeType: "image/png" }, false),
    ).toBeNull();
  });

  it("is read-only for everyone while the owner's drive is full", () => {
    expect(collabMode(access("owner"), file, true)).toBe("read-only");
    expect(collabMode(access("editor"), file, true)).toBe("read-only");
  });
});
