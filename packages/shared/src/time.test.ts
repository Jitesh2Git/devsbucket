import { describe, expect, it } from "vitest";
import { timeAgo } from "./time.ts";

const now = new Date("2026-11-16T12:00:00Z");
const ago = (seconds: number) => timeAgo(new Date(now.getTime() - seconds * 1000), now);

describe("timeAgo", () => {
  it.each([
    [0, "just now"],
    [59, "just now"],
    [60, "1 minute ago"],
    [5 * 60, "5 minutes ago"],
    [2 * 60 * 60, "2 hours ago"],
    [24 * 60 * 60, "yesterday"],
    [3 * 24 * 60 * 60, "3 days ago"],
    [14 * 24 * 60 * 60, "2 weeks ago"],
    [400 * 24 * 60 * 60, "last year"],
  ])("%i seconds ago is %s", (seconds, text) => {
    expect(ago(seconds)).toBe(text);
  });
});
