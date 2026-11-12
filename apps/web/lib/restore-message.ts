// What the user is told after a restore (decision 0007: never a silent
// rename or move).
export const restoreMessage = ({
  name,
  renamed,
  movedToTop,
}: {
  name: string;
  renamed: boolean;
  movedToTop: boolean;
}) => {
  if (movedToTop) {
    return `Restored "${name}" to My Drive: its folder is in the trash`;
  }
  return renamed ? `Restored as "${name}"` : `Restored "${name}"`;
};
