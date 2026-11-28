// Multi-select in a list, like Google Drive: which items are selected, and
// the one a Shift-click counts from (the anchor). Pure functions over the
// list's ids in display order, so the rules are tested without a browser.

export type Selection = {
  selected: ReadonlySet<string>;
  anchor: string | null;
};

export const EMPTY_SELECTION: Selection = { selected: new Set(), anchor: null };

// What a click does:
// - "only":   select just this one (a plain click)
// - "toggle": add it or take it out (Cmd/Ctrl-click, a tap while selecting)
// - "range":  everything from the anchor to this one (Shift-click)
export type ClickMode = "only" | "toggle" | "range";

export const clickMode = (keys: {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): ClickMode => {
  if (keys.shiftKey) return "range";
  if (keys.metaKey || keys.ctrlKey) return "toggle";
  return "only";
};

export const clickItem = (
  state: Selection,
  order: readonly string[],
  id: string,
  mode: ClickMode,
): Selection => {
  if (mode === "toggle") {
    const selected = new Set(state.selected);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    return { selected, anchor: id };
  }
  const from = state.anchor === null ? -1 : order.indexOf(state.anchor);
  const to = order.indexOf(id);
  if (mode === "range" && from !== -1 && to !== -1) {
    const [start, end] = from < to ? [from, to] : [to, from];
    // The anchor stays, so the next Shift-click counts from it again.
    return { selected: new Set(order.slice(start, end + 1)), anchor: state.anchor };
  }
  return { selected: new Set([id]), anchor: id };
};

export const selectAll = (state: Selection, order: readonly string[]): Selection => ({
  selected: new Set(order),
  anchor: state.anchor ?? order[0] ?? null,
});

// A box dragged over the list: what it touches, plus what was selected
// before the drag when Cmd/Ctrl/Shift was held.
export const boxSelect = (
  before: Selection,
  touched: readonly string[],
  additive: boolean,
): Selection => {
  const selected = new Set(additive ? before.selected : []);
  for (const id of touched) selected.add(id);
  return { selected, anchor: touched[0] ?? before.anchor };
};

// Rows that left the list (trashed, moved, deleted by someone else) leave
// the selection too. The same object back when nothing changed, so React
// doesn't re-render for nothing.
export const keepListed = (state: Selection, order: readonly string[]): Selection => {
  const listed = new Set(order);
  const selected = [...state.selected].filter((id) => listed.has(id));
  const anchor = state.anchor !== null && listed.has(state.anchor) ? state.anchor : null;
  if (selected.length === state.selected.size && anchor === state.anchor) {
    return state;
  }
  return { selected: new Set(selected), anchor };
};
