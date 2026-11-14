import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The file page (Phase 4, step 2): a text file opens in Monaco, bundled with
// the app (no CDN), read-only for now. Files that aren't UTF-8 text say why.
test("file page: text opens in the editor, others say why, no access", async ({ page }) => {
  // Several page loads, and Monaco is heavy.
  test.slow();
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "editor"));

  // Someone else's file, to try to open.
  const other = await db.query<{ id: string }>(
    "insert into users (name, email) values ('Other', $1) returning id",
    [`e2e-other-${Date.now()}@example.test`],
  );
  const secret = await db.query<{ id: string }>(
    `insert into items (owner_id, type, name, size, mime_type, storage_key)
     values ($1, 'file', 'secret.ts', 5, 'text/plain', $2) returning id`,
    [other.rows[0]?.id, `items/secret-${Date.now()}`],
  );

  await test.step("upload a code file and a Latin-1 file", async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles([
      {
        name: "answer.ts",
        mimeType: "text/plain",
        buffer: Buffer.from("export const answer = 42;\n"),
      },
      // "café" in Latin-1: not valid UTF-8.
      { name: "latin.txt", mimeType: "text/plain", buffer: Buffer.from([0x63, 0x61, 0x66, 0xe9]) },
    ]);
    await expect(page.getByText("Uploads finished")).toBeVisible();
  });

  await test.step("a text file opens on its own page, in the editor", async () => {
    // Anything the file page loads from another host (a CDN).
    const elsewhere: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname !== "localhost") {
        elsewhere.push(request.url());
      }
    });
    await page.getByRole("link", { name: "answer.ts", exact: true }).click();
    await expect(page).toHaveURL(/\/drive\/files\//);
    await expect(page.getByRole("heading", { name: "answer.ts" })).toBeVisible();
    await expect(page.getByRole("code")).toContainText("export const answer = 42;");
    await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
    // Monaco comes from our own server.
    expect(elsewhere).toEqual([]);
  });

  await test.step("leaving the file and coming back gives a working editor", async () => {
    // Next keeps the left page alive but hidden; the editor must survive that.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (let round = 0; round < 2; round++) {
      await page.getByRole("link", { name: "My Drive" }).first().click();
      // In the folder's table: the file page's breadcrumb is a "link" too.
      await page.getByRole("table").getByRole("link", { name: "answer.ts", exact: true }).click();
      await expect(page.getByRole("code")).toContainText("export const answer = 42;");
    }
    expect(errors).toEqual([]);
  });

  await test.step("a file that isn't UTF-8 says why", async () => {
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await page.getByRole("link", { name: "latin.txt", exact: true }).click();
    await expect(
      page.getByText("This file isn't UTF-8 text, so it can't be edited."),
    ).toBeVisible();
  });

  await test.step("someone else's file: You need access; no file: not found", async () => {
    await page.goto(`/drive/files/${secret.rows[0]?.id}`);
    await expect(page.getByText("You need access")).toBeVisible();
    // notFound() streams inside <Suspense>, so the status stays 200 (like folders).
    await page.goto("/drive/files/0190e0e0-0000-7000-8000-000000000000");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });

  await db.end();
});
