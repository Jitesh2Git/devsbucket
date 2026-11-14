import { describe, expect, it } from "vitest";
import {
  type ActivityEvent,
  accessChangedFor,
  changedFolders,
  clientMessageSchema,
} from "./realtime.ts";

const event = (action: ActivityEvent["action"], metadata: Record<string, unknown> = {}) => ({
  itemId: "item",
  action,
  actorId: "ada",
  metadata,
});

describe("changedFolders", () => {
  it("changes the item's folder for most content actions", () => {
    for (const action of ["created", "uploaded", "renamed", "trashed", "restored"] as const) {
      expect(changedFolders(event(action))).toBe("parent");
    }
  });

  it("changes both ends of a move, and the folder of something deleted forever", () => {
    expect(changedFolders(event("moved", { from: null, to: "docs" }))).toEqual([null, "docs"]);
    expect(changedFolders(event("deleted_forever", { name: "a", type: "file" }))).toEqual(["item"]);
  });

  it("changes no listing when sharing changes", () => {
    expect(changedFolders(event("shared", { userId: "bob", role: "viewer" }))).toBeNull();
  });
});

describe("accessChangedFor", () => {
  it("names the person whose access changed", () => {
    expect(accessChangedFor(event("access_removed", { userId: "bob", role: "editor" }))).toEqual([
      "bob",
    ]);
    expect(
      accessChangedFor(event("ownership_transferred", { fromUserId: "ada", toUserId: "bob" })),
    ).toEqual(["ada", "bob"]);
    expect(accessChangedFor(event("link_disabled"))).toEqual(["link-visitors"]);
    expect(accessChangedFor(event("uploaded", { size: 1 }))).toEqual([]);
  });
});

describe("clientMessageSchema", () => {
  it("accepts subscribe and unsubscribe, and nothing else", () => {
    const folderId = "0198c5a0-0000-7000-8000-000000000000";
    expect(clientMessageSchema.safeParse({ type: "subscribe", folderId }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ type: "unsubscribe", folderId: null }).success).toBe(
      true,
    );
    expect(clientMessageSchema.safeParse({ type: "subscribe", folderId: "x" }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: "send", folderId: null }).success).toBe(false);
  });
});
