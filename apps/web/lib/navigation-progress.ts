"use client";

import { useSyncExternalStore } from "react";

// Whether the app is moving to another page (the top bar and the logo's
// bucket show it). Next.js doesn't say when a navigation starts, so
// NavigationProgress starts it on a click on an in-app link and ends it
// when the URL changes; a timeout ends one that never lands.
const listeners = new Set<() => void>();
let navigating = false;
let timeout: ReturnType<typeof setTimeout> | undefined;

const emit = () => {
  for (const listener of listeners) listener();
};

export const startNavigation = () => {
  if (navigating) return;
  navigating = true;
  clearTimeout(timeout);
  timeout = setTimeout(endNavigation, 15_000);
  emit();
};

export const endNavigation = () => {
  if (!navigating) return;
  navigating = false;
  clearTimeout(timeout);
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useNavigating = () =>
  useSyncExternalStore(
    subscribe,
    () => navigating,
    () => false,
  );
