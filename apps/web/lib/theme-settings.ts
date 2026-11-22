"use client";

import { buildTheme } from "@devsbucket/shared/theme-engine";
import {
  DEFAULT_THEME_SETTINGS,
  FONTS,
  GREYS,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeSettings,
} from "@devsbucket/shared/themes";
import { useSyncExternalStore } from "react";

// This browser's theme (decision 0018), kept in localStorage like the
// grid/table view. The <head> script applies it on load; changes here are
// saved and applied to <html> at once, and other tabs follow through the
// "storage" event. Where localStorage is blocked, a change lasts until the
// page reloads.
const listeners = new Set<() => void>();
let current: ThemeSettings | null = null;

const readSaved = (): ThemeSettings => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    const saved: ThemeSettings = raw
      ? { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(raw) }
      : DEFAULT_THEME_SETTINGS;
    return THEMES.some((theme) => theme.id === saved.theme)
      ? saved
      : { ...saved, theme: DEFAULT_THEME_SETTINGS.theme };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
};

const snapshot = () => {
  current ??= readSaved();
  return current;
};

const apply = (settings: ThemeSettings) => {
  const built = buildTheme(settings, THEMES, FONTS, GREYS);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(built.vars)) root.style.setProperty(name, value);
  for (const [name, value] of Object.entries(built.attrs)) root.setAttribute(name, value);
};

const changed = (settings: ThemeSettings) => {
  current = settings;
  apply(settings);
  for (const listener of listeners) listener();
};

export const setThemeSettings = (changes: Partial<ThemeSettings>) => {
  const next = { ...snapshot(), ...changes };
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Blocked: `current` keeps it for this page.
  }
  changed(next);
};

export const resetThemeSettings = () => {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Blocked: nothing was saved anyway.
  }
  changed(DEFAULT_THEME_SETTINGS);
};

const onStorage = (event: StorageEvent) => {
  if (event.key === THEME_STORAGE_KEY) changed(readSaved());
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
};

// Runs `listener` after every change (here or in another tab), once the new
// theme is on <html>. Returns the function that stops it.
export const onThemeChange = (listener: () => void) => subscribe(listener);

// The server doesn't know the choice, so it renders the default; right
// after hydration React switches to the saved one.
export const useThemeSettings = () =>
  useSyncExternalStore(subscribe, snapshot, () => DEFAULT_THEME_SETTINGS);
