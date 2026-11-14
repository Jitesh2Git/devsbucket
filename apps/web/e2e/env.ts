// Shared by playwright.config.ts, global-setup.ts and the tests.
export const E2E_PORT = 3100;
export const E2E_REALTIME_PORT = 3101;
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

// And the test bucket next to the dev one: devsbucket -> devsbucket-test
// (created by `pnpm storage:setup-test`). Bucket names can't contain "_".
export const testBucket = () => {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET is not set (apps/web/.env.local, or the CI environment)");
  }
  return `${bucket}-test`;
};

// What a process needs to work on the test data instead of the dev data.
export const testEnv = () => ({ DATABASE_URL: testDatabaseUrl(), S3_BUCKET: testBucket() });
