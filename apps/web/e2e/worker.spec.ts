import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { testEnv } from "./env";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The worker's jobs (apps/worker), run for real against the test database and
// bucket. "Time travel": rows are made old with SQL, then the job runs now.
const runJob = (name: "cleanup-uploads" | "empty-trash") =>
  execFileSync("pnpm", ["--filter", "worker", "job", name], {
    env: { ...process.env, ...testEnv() },
    encoding: "utf8",
  });

test("worker: abandoned uploads and old trash are cleaned up, recent ones stay", async ({
  page,
}) => {
  test.slow();
  const db = await connectTestDb();
  const email = await test.step("sign up", () => signUpWithOwnInvite(page, db, "worker"));

  const query = async <T>(text: string, values: unknown[] = []) =>
    (await db.query(text, values)).rows as T[];
  const storageUsed = async () =>
    Number(
      (
        await query<{ used: string }>("select storage_used as used from users where email = $1", [
          email,
        ])
      )[0]?.used,
    );
  const exists = async (name: string) =>
    (await query("select 1 from items where name = $1", [name])).length > 0;
  const upload = async (name: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from("0123456789"),
    });
  };
  const moveToTrash = async (name: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await expect(page.getByText(`"${name}" moved to trash`)).toBeVisible();
  };

  await test.step("an upload left pending for 2 hours is cleaned up", async () => {
    // Hold the PUT so the upload stays pending, like a closed tab.
    const putStarted = new Promise<void>((resolve) => {
      void page.route(/\/items\/[0-9a-f-]+\?/, () => resolve());
    });
    await upload("abandoned.txt");
    await putStarted;
    expect(await storageUsed()).toBe(10);
    await db.query(
      "update items set created_at = now() - interval '2 hours' where name = 'abandoned.txt'",
    );
    runJob("cleanup-uploads");
    expect(await exists("abandoned.txt")).toBe(false);
    expect(await storageUsed()).toBe(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.reload();
  });

  let oldFileUrl = "";
  await test.step("files in the trash for 31 and 29 days", async () => {
    for (const name of ["old.txt", "young.txt"]) {
      await upload(name);
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
    // Where old.txt is stored, to check later that the object is gone too.
    const [old] = await query<{ id: string }>("select id from items where name = 'old.txt'");
    const download = await page.request.get(`/api/items/${old?.id}/download`, {
      maxRedirects: 0,
    });
    oldFileUrl = download.headers().location ?? "";
    expect((await fetch(oldFileUrl)).status).toBe(200);
    await moveToTrash("old.txt");
    await moveToTrash("young.txt");
    await db.query(
      "update items set trashed_at = now() - interval '31 days' where name = 'old.txt'",
    );
    await db.query(
      "update items set trashed_at = now() - interval '29 days' where name = 'young.txt'",
    );
    expect(await storageUsed()).toBe(20);
  });

  await test.step("the daily job deletes only what's older than 30 days", async () => {
    runJob("empty-trash");
    expect(await exists("old.txt")).toBe(false);
    expect(await exists("young.txt")).toBe(true);
    expect(await storageUsed()).toBe(10);
    // The stored object is gone as well.
    expect((await fetch(oldFileUrl)).status).toBe(404);
  });

  await db.end();
});
