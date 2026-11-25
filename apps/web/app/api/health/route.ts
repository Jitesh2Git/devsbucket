import { databaseIsUp } from "@devsbucket/db/health";
import { connection } from "next/server";

// GET /api/health (Phase 6): for Docker's health check, the deploy script
// and the uptime monitor. 200 when the app answers and the database does,
// 503 otherwise. No data and no session, so anyone may call it.
export const GET = async () => {
  // Always at request time: never prerendered at build (no database there).
  await connection();
  const up = await databaseIsUp();
  return new Response(up ? "ok" : "database unavailable", {
    status: up ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
};
