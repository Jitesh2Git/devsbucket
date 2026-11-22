"use client";

import { useSyncExternalStore } from "react";

// Table or grid, for every list in the drive, remembered per browser in
// localStorage. Every list on the page (and in hidden pages kept by
// Activity) follows a change at once, and other tabs follow it through
// the "storage" event. Where localStorage is blocked (some private
// windows), the choice lasts until the page reloads.
export type ViewMode = "table" | "grid";

const KEY = "devsbucket:view";
const listeners = new Set<() => void>();
let fallback: ViewMode = "table";

const read = (): ViewMode => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "grid" || saved === "table" ? saved : fallback;
  } catch {
    return fallback;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

export const setViewMode = (mode: ViewMode) => {
  fallback = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Blocked: `fallback` keeps it for this page.
  }
  for (const listener of listeners) listener();
};

// The server doesn't know the choice, so it renders the table; right after
// hydration React switches to the saved one (useSyncExternalStore's server
// snapshot), with no mismatch error.
export const useViewMode = () => useSyncExternalStore(subscribe, read, () => "table" as const);
