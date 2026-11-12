// One line per event, with the time, so `pnpm dev` output stays readable.
export const log = (message: string) => {
  console.log(`${new Date().toISOString()} [worker] ${message}`);
};
