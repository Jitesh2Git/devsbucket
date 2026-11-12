import pg from "pg";
import { testDatabaseUrl } from "./env";

// A direct connection to the test database, for setting up what the UI
// can't (yet): another user's folder, many rows at once. Never the dev one.
export const connectTestDb = async () => {
  const client = new pg.Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  return client;
};
