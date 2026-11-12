import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// A real 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("previews and downloads: text, image, HTML as text, download name, 404s", async ({ page }) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "previews"));

  // Someone else's file, to try to fetch.
  const other = await db.query<{ id: string }>(
    "insert into users (name, email) values ('Other', $1) returning id",
    [`e2e-other-${Date.now()}@example.test`],
  );
  const secret = await db.query<{ id: string }>(
    `insert into items (owner_id, type, name, size, mime_type, storage_key)
     values ($1, 'file', 'secret.txt', 5, 'text/plain', 'items/secret') returning id`,
    [other.rows[0]?.id],
  );

  // A script in an uploaded file must never run.
  page.on("dialog", () => {
    throw new Error("A script from an uploaded file ran");
  });

  await test.step("upload a few files", async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles([
      { name: "résumé.md", mimeType: "text/markdown", buffer: Buffer.from("# Hello preview\n") },
      { name: "pixel.png", mimeType: "image/png", buffer: PNG },
      {
        name: "page.html",
        mimeType: "text/html",
        buffer: Buffer.from("<h1>hi</h1><script>alert(1)</script>"),
      },
    ]);
    await expect(page.getByText("Uploads finished")).toBeVisible();
  });

  const dialog = page.getByRole("dialog");
  const close = () => dialog.getByRole("button", { name: "Close" }).first().click();

  await test.step("a text file shows its content", async () => {
    await page.getByRole("button", { name: "résumé.md", exact: true }).click();
    await expect(dialog.getByText("# Hello preview")).toBeVisible();
    await close();
    await expect(dialog).toBeHidden();
  });

  await test.step("an image is shown", async () => {
    await page.getByRole("button", { name: "pixel.png", exact: true }).click();
    const image = dialog.getByRole("img", { name: "pixel.png" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
    await close();
  });

  await test.step("HTML is shown as text, never rendered", async () => {
    await page.getByRole("button", { name: "page.html", exact: true }).click();
    await expect(dialog.getByText("<script>alert(1)</script>")).toBeVisible();
    await close();
    const { rows } = await db.query<{ id: string }>(
      "select id from items where name = 'page.html'",
    );
    const inline = await page.request.get(`/api/items/${rows[0]?.id}/preview`);
    expect(inline.status()).toBe(404);
  });

  await test.step("download keeps the file name", async () => {
    await page.getByRole("button", { name: "Actions for résumé.md" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download" }).click();
    expect((await download).suggestedFilename()).toBe("résumé.md");
  });

  await test.step("someone else's file, or no file, is a 404", async () => {
    for (const id of [secret.rows[0]?.id, "not-a-file"]) {
      expect((await page.request.get(`/api/items/${id}/download`)).status()).toBe(404);
      expect((await page.request.get(`/api/items/${id}/preview`)).status()).toBe(404);
    }
  });

  await db.end();
});
