"use client";

import {
  boxSelect,
  clickItem,
  clickMode,
  EMPTY_SELECTION,
  keepListed,
  type Selection,
  selectAll,
} from "@devsbucket/shared/selection";
import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Multi-select on a list page (Google Drive style). The provider wraps the
// page, so the list (which rows are selected) and the header (the
// selection bar, in place of the folder's buttons) share one selection.
//
// - Click selects one; Cmd/Ctrl-click adds or removes; Shift-click selects
//   a range; dragging from anywhere in the list draws a box.
// - Double-click, or Enter on the focused name, opens; Space selects.
// - Touch: a tap opens, a long press starts selecting, and then taps add
//   or remove.
// - Esc clears; Cmd/Ctrl+A selects everything loaded.

export type SelectableItem = { id: string; name: string; type: "folder" | "file" };

type SelectionContextValue<T extends SelectableItem> = {
  // The selected rows, in list order.
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  clear: () => void;
  // Called by the list with its rows (after each page and refetch).
  setRows: (rows: T[]) => void;
  update: (change: (state: Selection, order: string[]) => Selection) => void;
  // The selection right now (for a drag that started earlier).
  current: () => Selection;
};

// biome-ignore lint/suspicious/noExplicitAny: each page decides its row type.
const SelectionContext = createContext<SelectionContextValue<any> | null>(null);

export const useSelection = <T extends SelectableItem>() => {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection needs a SelectionProvider");
  }
  return context as SelectionContextValue<T>;
};

// Typing in a field or working in a dialog keeps its own Esc and Cmd+A.
const isTyping = (target: EventTarget | null) =>
  target instanceof Element &&
  (target.closest("input, textarea, select, [contenteditable=true]") !== null ||
    target.closest("[role=dialog], [role=alertdialog], [role=menu]") !== null);

export const SelectionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Selection>(EMPTY_SELECTION);
  const [rows, setRowsState] = useState<SelectableItem[]>([]);
  const order = useMemo(() => rows.map((row) => row.id), [rows]);

  const setRows = useCallback((next: SelectableItem[]) => setRowsState(next), []);
  const update = useCallback(
    (change: (state: Selection, order: string[]) => Selection) =>
      setState((current) => change(current, order)),
    [order],
  );
  const clear = useCallback(() => setState(EMPTY_SELECTION), []);
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  }, [state]);
  const current = useCallback(() => latest.current, []);

  // Rows that left the list leave the selection.
  useEffect(() => setState((current) => keepListed(current, order)), [order]);

  // Leaving the page only hides it (React Activity): start empty on return.
  useLayoutEffect(() => () => setState(EMPTY_SELECTION), []);

  const count = state.selected.size;
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      if (event.key === "Escape" && count > 0) {
        setState(EMPTY_SELECTION);
      } else if (event.key === "a" && (event.metaKey || event.ctrlKey) && order.length > 0) {
        event.preventDefault();
        setState((current) => selectAll(current, order));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [count, order]);

  const value = useMemo(
    () => ({
      selectedItems: rows.filter((row) => state.selected.has(row.id)),
      isSelected: (id: string) => state.selected.has(id),
      clear,
      setRows,
      update,
      current,
    }),
    [rows, state, clear, setRows, update, current],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};

// A press that lasts this long on a touch screen starts selecting.
const LONG_PRESS_MS = 500;
// Moving further than this (px) is a scroll or a drag, not a press.
const MOVE_SLOP = 6;

// A click on something inside the row other than its name (the ⋯ menu,
// a menu item in its portal) is that control's, not the selection's.
const onOtherControl = (target: EventTarget) =>
  target instanceof Element &&
  target.closest("a, button, input, [role=menuitem]") !== null &&
  target.closest("[data-item-name]") === null;

type Press = { x: number; y: number; timer?: ReturnType<typeof setTimeout> };

// The props for one row or card: spread them on the <li> or <tr>. `open`
// opens the item (its page, the editor or the preview).
export const useSelectableRows = () => {
  const { update, isSelected, selectedItems } = useSelection();
  const press = useRef<Press | null>(null);
  // A long press or a box drag just ended: the click that follows it is
  // part of it, not a click of its own.
  const swallowClick = useRef(false);
  const selecting = selectedItems.length > 0;

  const marquee = useMarquee((touched, additive, before) =>
    update(() => boxSelect(before, touched, additive)),
  );

  const rowProps = (item: SelectableItem, open: () => void) => ({
    "data-item-id": item.id,
    "data-selected": isSelected(item.id) || undefined,
    // Capture: before the name's own link or button handles the click.
    onClickCapture: (event: MouseEvent) => {
      if (onOtherControl(event.target)) return;
      // The name's own link or preview button never sees the click.
      event.preventDefault();
      event.stopPropagation();
      if (swallowClick.current || marquee.justDragged()) {
        swallowClick.current = false;
        return;
      }
      // detail 0: Enter on the focused name (a keyboard "click").
      if (event.detail === 0) {
        open();
        return;
      }
      const touch = (event.nativeEvent as globalThis.PointerEvent).pointerType === "touch";
      if (touch) {
        if (selecting) {
          update((state, order) => clickItem(state, order, item.id, "toggle"));
        } else {
          open();
        }
        return;
      }
      update((state, order) => clickItem(state, order, item.id, clickMode(event)));
    },
    onDoubleClick: (event: MouseEvent) => {
      if (onOtherControl(event.target)) return;
      open();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== " " || onOtherControl(event.target)) return;
      event.preventDefault();
      update((state, order) => clickItem(state, order, item.id, "toggle"));
    },
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== "touch" || onOtherControl(event.target)) return;
      const timer = setTimeout(() => {
        swallowClick.current = true;
        navigator.vibrate?.(10);
        update((state, order) => clickItem(state, order, item.id, "toggle"));
      }, LONG_PRESS_MS);
      press.current = { x: event.clientX, y: event.clientY, timer };
    },
    onPointerMove: (event: PointerEvent) => {
      const start = press.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_SLOP) {
        clearTimeout(start.timer);
        press.current = null;
      }
    },
    onPointerUp: () => {
      clearTimeout(press.current?.timer);
      press.current = null;
    },
    onPointerCancel: () => {
      clearTimeout(press.current?.timer);
      press.current = null;
    },
    // A long press on a phone would also open the browser's own menu.
    onContextMenu: (event: MouseEvent) => {
      if ((event.nativeEvent as globalThis.PointerEvent).pointerType === "touch") {
        event.preventDefault();
      }
    },
  });

  return { rowProps, listProps: marquee.listProps, box: marquee.box };
};

type Box = { left: number; top: number; width: number; height: number };

// Drag a box over the list to select what it touches (mouse only; on touch
// a drag scrolls). Coordinates are relative to the list element, which
// moves with its content when the page scrolls, so a box keeps its place.
const useMarquee = (onBox: (touched: string[], additive: boolean, before: Selection) => void) => {
  const list = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const dragged = useRef(false);
  const { current, clear } = useSelection();

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = list.current;
    if (!element || event.pointerType !== "mouse" || event.button !== 0) return;
    if (onOtherControl(event.target)) return;
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    const onRow = event.target instanceof Element && event.target.closest("[data-item-id]");
    const at = (e: { clientX: number; clientY: number }) => {
      const rect = element.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const start = at(event);
    const before = current();
    let moving = false;

    const onMove = (e: globalThis.PointerEvent) => {
      const now = at(e);
      if (!moving && Math.hypot(now.x - start.x, now.y - start.y) < MOVE_SLOP) return;
      moving = true;
      const next = {
        left: Math.min(start.x, now.x),
        top: Math.min(start.y, now.y),
        width: Math.abs(now.x - start.x),
        height: Math.abs(now.y - start.y),
      };
      setBox(next);
      const listRect = element.getBoundingClientRect();
      const touched = [...element.querySelectorAll<HTMLElement>("[data-item-id]")]
        .filter((row) => {
          const r = row.getBoundingClientRect();
          const left = r.left - listRect.left;
          const top = r.top - listRect.top;
          return (
            left < next.left + next.width &&
            left + r.width > next.left &&
            top < next.top + next.height &&
            top + r.height > next.top
          );
        })
        .map((row) => row.dataset.itemId ?? "");
      onBox(touched, additive, before);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setBox(null);
      if (moving) {
        // The click after a drag ends on a row or the list: skip it.
        dragged.current = true;
        setTimeout(() => {
          dragged.current = false;
        }, 0);
      } else if (!onRow && !additive) {
        // A plain click on empty space clears, as in Drive.
        clear();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return {
    box,
    justDragged: () => dragged.current,
    listProps: {
      ref: list,
      onPointerDown,
      // Links and images would otherwise start the browser's own drag.
      onDragStart: (event: MouseEvent) => event.preventDefault(),
    },
  };
};
