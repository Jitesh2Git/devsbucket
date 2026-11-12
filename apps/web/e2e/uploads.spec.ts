import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

const textFile = (name: string, text: string) => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(text),
});

test("uploads: upload, name clash, into a folder, quota full, cancel, multipart", async ({
  page,
}, testInfo) => {
  const db = await connectTestDb();
  const email = await test.step("sign up", () => signUpWithOwnInvite(page, db, "uploads"));

  // Through the visible Upload button and the browser's file chooser: the
  // folder you came from stays in the page, hidden (Next's <Activity>), with
  // its own file input.
  const upload = async (file: ReturnType<typeof textFile> | string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles(file);
  };
  const panel = page.getByRole("region", { name: "Uploads" });
  const usage = async () => {
    const { rows } = await db.query<{ used: string; pending: string }>(
      `select u.storage_used as used,
              (select count(*) from items i where i.owner_id = u.id and i.status = 'pending') as pending
       from users u where u.email = $1`,
      [email],
    );
    return { used: Number(rows[0]?.used), pending: Number(rows[0]?.pending) };
  };

  await test.step("upload a file", async () => {
    await upload(textFile("hello.txt", "hello world\n"));
    await expect(panel.getByText("Uploads finished")).toBeVisible();
    await expect(page.getByRole("cell", { name: "hello.txt" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "12 B" })).toBeVisible();
    // The storage meter is refreshed after the batch.
    await expect(page.getByText("12 B of 1 GB used")).toBeVisible();
  });

  await test.step("the same name again is saved as hello (1).txt, visibly", async () => {
    await upload(textFile("Hello.txt", "again\n"));
    await expect(
      panel.getByText("Saved as Hello (1).txt: Hello.txt already exists here"),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hello (1).txt" })).toBeVisible();
  });

  await test.step("upload into a folder", async () => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill("Docs");
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("link", { name: "Docs" }).click();
    await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();
    await upload(textFile("inside.txt", "in a folder\n"));
    await expect(page.getByRole("cell", { name: "inside.txt" })).toBeVisible();
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(page.getByRole("cell", { name: "hello.txt", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "inside.txt" })).toBeHidden();
  });

  await test.step("a full quota refuses the upload", async () => {
    const before = await usage();
    await db.query("update users set storage_quota = storage_used + 5 where email = $1", [email]);
    await upload(textFile("too-much.txt", "more than five bytes\n"));
    await expect(panel.getByText(/^Not enough space: /)).toBeVisible();
    await expect(page.getByRole("cell", { name: "too-much.txt" })).toBeHidden();
    expect(await usage()).toEqual(before);
    await db.query("update users set storage_quota = 1073741824 where email = $1", [email]);
  });

  await test.step("cancelling leaves nothing behind", async () => {
    const before = await usage();
    // Hold the PUT to storage (never answer it), so there's time to cancel.
    const putStarted = new Promise<void>((resolve) => {
      void page.route(/\/items\/[0-9a-f-]+\?/, () => resolve());
    });
    await upload(textFile("slow.txt", "never arrives\n"));
    await putStarted;
    expect((await usage()).pending).toBe(1);
    await panel.getByRole("button", { name: "Cancel slow.txt" }).click();
    await expect(panel.getByText("Cancelled")).toBeVisible();
    await expect.poll(usage).toEqual(before);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  // Over 50 MB: parts. Playwright only passes files over 50 MB by path.
  const bigFile = testInfo.outputPath("big.bin");
  await writeFile(bigFile, Buffer.alloc(55 * 1024 * 1024, 7));

  await test.step("a file over 50 MB goes up in parts", async () => {
    await upload(bigFile);
    await expect(page.getByRole("cell", { name: "big.bin" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("cell", { name: "55 MB" })).toBeVisible();
    const { rows } = await db.query<{ size: string; upload_id: string | null }>(
      "select size, upload_id from items where name = 'big.bin' and status = 'ready'",
    );
    expect(Number(rows[0]?.size)).toBe(55 * 1024 * 1024);
    expect(rows[0]?.upload_id).not.toBeNull();
  });

  await test.step("cancelling a multipart upload leaves nothing behind", async () => {
    const before = await usage();
    // Hold every part (never answer), so there's time to cancel.
    const partsStarted = new Promise<void>((resolve) => {
      void page.route(/partNumber=/, () => resolve());
    });
    await upload(bigFile);
    await partsStarted;
    expect((await usage()).pending).toBe(1);
    await panel.getByRole("button", { name: "Cancel big.bin" }).click();
    await expect.poll(usage).toEqual(before);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  await db.end();
});
