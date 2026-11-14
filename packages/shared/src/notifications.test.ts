import { describe, expect, it } from "vitest";
import {
  notificationGroups,
  notificationPrefSchema,
  notificationText,
  notificationTypes,
  planNotifications,
} from "./notifications.ts";

const team = { id: "team", name: "Team", ownerId: "ada", parentId: null };
const plan = { id: "plan", name: "plan.txt", ownerId: "ada", parentId: "team" };

describe("planNotifications", () => {
  it("tells the person a share is about", () => {
    expect(
      planNotifications(
        {
          action: "shared",
          actorId: "ada",
          itemId: "team",
          metadata: { userId: "bob", role: "editor" },
        },
        team,
      ),
    ).toEqual([
      { recipientId: "bob", type: "shared", itemId: "team", payload: { role: "editor" } },
    ]);
  });

  it("tells the owner about content, on the folder it's in", () => {
    expect(
      planNotifications(
        { action: "uploaded", actorId: "bob", itemId: "plan", metadata: { size: 4 } },
        plan,
      ),
    ).toEqual([
      { recipientId: "ada", type: "files_added", itemId: "team", payload: { name: "plan.txt" } },
    ]);
  });

  it("never tells the person who acted", () => {
    expect(
      planNotifications(
        { action: "uploaded", actorId: "ada", itemId: "plan", metadata: { size: 4 } },
        plan,
      ),
    ).toEqual([]);
    // Leaving something yourself logs access_removed with you as the actor.
    expect(
      planNotifications(
        { action: "access_removed", actorId: "bob", itemId: "team", metadata: { userId: "bob" } },
        team,
      ),
    ).toEqual([]);
  });

  it("sends access requests to everyone who may share it, but the requester", () => {
    const planned = planNotifications(
      { action: "access_requested", actorId: "cy", itemId: "team", metadata: { role: "viewer" } },
      team,
      ["ada", "bob", "cy"],
    );
    expect(planned.map((n) => n.recipientId)).toEqual(["ada", "bob"]);
  });

  it("tells the old owner when a transfer is accepted", () => {
    expect(
      planNotifications(
        {
          action: "ownership_transferred",
          actorId: "bob",
          itemId: "team",
          metadata: { fromUserId: "ada", toUserId: "bob" },
        },
        { ...team, ownerId: "bob" },
      ).map((n) => [n.recipientId, n.type]),
    ).toEqual([["ada", "ownership_transferred"]]);
  });

  it("ignores actions nobody is told about", () => {
    expect(
      planNotifications(
        { action: "renamed", actorId: "bob", itemId: "plan", metadata: { from: "a", to: "b" } },
        plan,
      ),
    ).toEqual([]);
  });
});

describe("notificationText", () => {
  const base = { actorName: "Bob", itemName: "Team", payload: {} };

  it("reads one batched item, or a count", () => {
    expect(
      notificationText({ ...base, type: "files_added", count: 1, payload: { name: "a.txt" } }),
    ).toBe('Bob added "a.txt" to "Team"');
    expect(notificationText({ ...base, type: "files_added", count: 5 })).toBe(
      'Bob added 5 files to "Team"',
    );
  });

  it("names the role, and falls back when the actor is gone", () => {
    expect(
      notificationText({ ...base, type: "shared", count: 1, payload: { role: "viewer" } }),
    ).toBe('Bob shared "Team" with you as viewer');
    expect(notificationText({ ...base, actorName: null, type: "access_removed", count: 1 })).toBe(
      'Someone removed your access to "Team"',
    );
  });
});

describe("notificationGroups", () => {
  it("has a switch for every type, once", () => {
    const listed = notificationGroups.flatMap((group) => group.types.map((t) => t.type));
    expect([...listed].sort()).toEqual([...notificationTypes].sort());
  });
});

describe("notificationPrefSchema", () => {
  it("refuses to turn off an always-on type", () => {
    expect(notificationPrefSchema.safeParse({ type: "files_added", enabled: false }).success).toBe(
      true,
    );
    expect(
      notificationPrefSchema.safeParse({ type: "access_removed", enabled: false }).success,
    ).toBe(false);
    expect(notificationPrefSchema.safeParse({ type: "nope", enabled: false }).success).toBe(false);
  });
});
