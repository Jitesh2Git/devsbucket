// Shared by playwright.config.ts, global-setup.ts and the tests.
export const E2E_PORT = 3100;
export const E2E_INVITE_CODE = "E2E-INVITE";

// The test database sits next to the dev one: devsbucket -> devsbucket_test.
export const testDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (apps/web/.env.local, or the CI environment)");
  }
  const url = new URL(databaseUrl);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
};
