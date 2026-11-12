// Postgres error code for a unique constraint violation.
const UNIQUE_VIOLATION = "23505";

// Drizzle wraps the driver error; the Postgres code is on `cause`.
export const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  (error.cause as { code?: string } | undefined)?.code === UNIQUE_VIOLATION;
