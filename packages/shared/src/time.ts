// "5 minutes ago", "yesterday", "3 weeks ago": how long ago a date was, in
// English like the rest of the app. Under a minute is "just now".
const UNITS = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
] as const;

const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const timeAgo = (date: Date, now: Date = new Date()) => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.trunc(seconds / size), unit);
    }
  }
  return "just now";
};
