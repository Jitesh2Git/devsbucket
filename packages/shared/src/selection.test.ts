import { describe, expect, it } from "vitest";
import {
  boxSelect,
  clickItem,
  clickMode,
  EMPTY_SELECTION,
  keepListed,
  type Selection,
  selectAll,
} from "./selection.ts";

const order = ["a", "b", "c", "d", "e"];
const ids = (state: Selection) => [...state.selected].sort();
const selection = (selected: string[], anchor: string | null): Selection => ({
  selected: new Set(selected),
  anchor,
});

describe("clickMode", () => {
  it("reads the modifier keys", () => {
    const keys = { shiftKey: false, metaKey: false, ctrlKey: false };
    expect(clickMode(keys)).toBe("only");
    expect(clickMode({ ...keys, metaKey: true })).toBe("toggle");
    expect(clickMode({ ...keys, ctrlKey: true })).toBe("toggle");
    expect(clickMode({ ...keys, shiftKey: true, metaKey: true })).toBe("range");
  });
});

describe("clickItem", () => {
  it("a plain click selects only that item", () => {
    const state = clickItem(selection(["a", "b"], "a"), order, "d", "only");
    expect(ids(state)).toEqual(["d"]);
    expect(state.anchor).toBe("d");
  });

  it("toggle adds and removes", () => {
    let state = clickItem(EMPTY_SELECTION, order, "b", "toggle");
    state = clickItem(state, order, "d", "toggle");
    expect(ids(state)).toEqual(["b", "d"]);
    state = clickItem(state, order, "b", "toggle");
    expect(ids(state)).toEqual(["d"]);
  });

  it("range selects from the anchor, either way, and keeps the anchor", () => {
    let state = clickItem(EMPTY_SELECTION, order, "b", "only");
    state = clickItem(state, order, "d", "range");
    expect(ids(state)).toEqual(["b", "c", "d"]);
    expect(state.anchor).toBe("b");
    state = clickItem(state, order, "a", "range");
    expect(ids(state)).toEqual(["a", "b"]);
  });

  it("range without an anchor acts like a plain click", () => {
    expect(ids(clickItem(EMPTY_SELECTION, order, "c", "range"))).toEqual(["c"]);
  });
});

describe("selectAll", () => {
  it("selects every listed item", () => {
    expect(ids(selectAll(EMPTY_SELECTION, order))).toEqual(order);
  });
});

describe("boxSelect", () => {
  it("replaces the selection, or adds to it", () => {
    const before = selection(["a"], "a");
    expect(ids(boxSelect(before, ["c", "d"], false))).toEqual(["c", "d"]);
    expect(ids(boxSelect(before, ["c", "d"], true))).toEqual(["a", "c", "d"]);
  });
});

describe("keepListed", () => {
  it("drops items that left the list", () => {
    const state = keepListed(selection(["a", "x"], "x"), order);
    expect(ids(state)).toEqual(["a"]);
    expect(state.anchor).toBeNull();
  });

  it("returns the same object when nothing changed", () => {
    const state = selection(["a", "b"], "a");
    expect(keepListed(state, order)).toBe(state);
  });
});
