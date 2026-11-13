// Vitest global setup for `pnpm test:db`: the test database exists and is
// migrated before any test runs. Tests roll back their own rows.
import { prepareTestDatabase } from "./test-database.ts";

export const setup = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  await prepareTestDatabase(url);
};
