import { randomUUID } from "node:crypto";
import { pool } from "@devsbucket/db/client";
import { getOpsThisMonth } from "@devsbucket/db/usage";
import { deleteObject, headObject, itemKey, presignPut } from "./objects.ts";

// A quick end-to-end check of the storage setup: CORS for the web app's
// origin, a presigned upload, the signed size, then cleanup. Uses a
// throwaway key; nothing is left behind.
const origin = "http://localhost:3000";
const key = itemKey(`check-${randomUUID()}`);
const body = "hello from storage:check\n";
const size = Buffer.byteLength(body);

const check = (label: string, passed: boolean, detail = "") => {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!passed) process.exitCode = 1;
};

const url = await presignPut({ key, contentType: "text/plain", size });

// What the browser asks before a cross-origin PUT.
const preflight = await fetch(url, {
  method: "OPTIONS",
  headers: {
    Origin: origin,
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "content-type",
  },
});
check(
  `CORS allows ${origin}`,
  preflight.ok && preflight.headers.get("access-control-allow-origin") !== null,
  `status ${preflight.status}`,
);

const wrongSize = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": "text/plain" },
  body: `${body}extra`,
});
check("a different size is refused", !wrongSize.ok, `status ${wrongSize.status}`);

const wrongType = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": "text/html" },
  body,
});
check("a different Content-Type is refused", !wrongType.ok, `status ${wrongType.status}`);

const put = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": "text/plain", Origin: origin },
  body,
});
check("presigned PUT", put.ok, `status ${put.status}`);
check(
  "ETag readable by the browser",
  put.headers.get("access-control-expose-headers")?.toLowerCase().includes("etag") ?? false,
);

const head = await headObject(key);
check("stored size matches", head?.size === size, `${head?.size} bytes`);

await deleteObject(key);
check("deleted", (await headObject(key)) === null);

const ops = await getOpsThisMonth();
console.log(`Operations this month: ${ops.classA} class A, ${ops.classB} class B`);

await pool.end();
