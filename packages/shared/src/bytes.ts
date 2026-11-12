const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

// Human-readable sizes in powers of 1024, like Google Drive and Finder's
// "1 GB" for a 1 GiB quota: 0 B, 512 B, 1.5 KB, 10 MB, 1 GB.
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError(`Not a byte count: ${bytes}`);
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // One decimal below 10 (1.5 KB), none above (15 KB); never "1.0".
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${UNITS[unit]}`;
};
