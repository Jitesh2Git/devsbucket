"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const serverFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

// A date in the visitor's own time zone and language. The server doesn't know
// them, so it renders UTC; right after hydration React swaps in the browser's
// version (useSyncExternalStore's server snapshot), with no mismatch error.
const LocalDate = ({ value }: { value: Date }) => {
  const text = useSyncExternalStore(
    subscribe,
    () => browserFormat.format(value),
    () => serverFormat.format(value),
  );
  return <time dateTime={value.toISOString()}>{text}</time>;
};

export default LocalDate;
