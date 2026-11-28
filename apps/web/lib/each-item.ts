// Several items at once (multi-select): each one is checked and done on
// its own, like one action per item, so one that's gone or not allowed
// doesn't stop the others. The answer says what worked and the first
// reason something didn't.
export const eachItem = async <T extends { error: string | null }>(
  itemIds: string[],
  run: (itemId: string) => Promise<T>,
) => {
  const done: Extract<T, { error: null }>[] = [];
  let failed = 0;
  let firstError: string | null = null;
  // One at a time: the same per-owner lock is taken by each, in order.
  for (const itemId of new Set(itemIds)) {
    const result = await run(itemId);
    if (result.error === null) {
      done.push(result as Extract<T, { error: null }>);
    } else {
      failed += 1;
      firstError ??= result.error;
    }
  }
  return { done, failed, firstError };
};
