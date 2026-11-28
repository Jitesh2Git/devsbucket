import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Recent (Phase 5, step 1): files opened in the editor or a preview, newest
// first; opening one again moves it up; a trashed file drops out.
test("recent: opened files newest first, reopened moves up, trashed drops out", async ({
  page,
}) => {
  // The editor page (Monaco) loads twice.
  test.slow();
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "recent"));

  const upload = async (name: string, mimeType: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType, buffer: Buffer.from(name) });
    await expect(page.getByRole("table").getByText(name, { exact: true })).toBeVisible();
  };
  const goTo = async (link: string, heading: string) => {
    await page.getByRole("link", { name: link }).first().click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  };
  // The Recent table lists exactly these names, top to bottom (row 0 is
  // the header).
  const expectRecent = async (names: string[]) => {
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(names.length + 1);
    for (const [index, name] of names.entries()) {
      await expect(rows.nth(index + 1)).toContainText(name);
    }
  };

  await test.step("Recent starts empty", async () => {
    await goTo("Recent", "Recent");
    await expect(page.getByText("Nothing opened yet")).toBeVisible();
  });

  await test.step("open a text file in the editor and an image in the preview", async () => {
    await goTo("My Drive", "My Drive");
    await upload("notes.txt", "text/plain");
    await upload("photo.png", "image/png");
    await page.getByRole("table").getByRole("link", { name: "notes.txt", exact: true }).dblclick();
    await expect(page.getByRole("heading", { name: "notes.txt" })).toBeVisible();
    await goTo("My Drive", "My Drive");
    await page
      .getByRole("table")
      .getByRole("button", { name: "photo.png", exact: true })
      .dblclick();
    await expect(page.getByRole("dialog", { name: "photo.png" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  await test.step("Recent lists both, newest first, owned by me", async () => {
    await goTo("Recent", "Recent");
    await expectRecent(["photo.png", "notes.txt"]);
    await expect(
      page.getByRole("row").filter({ hasText: "notes.txt" }).getByRole("cell", { name: "me" }),
    ).toBeVisible();
  });

  await test.step("opening notes.txt from Recent moves it to the top", async () => {
    await page.getByRole("table").getByRole("link", { name: "notes.txt", exact: true }).dblclick();
    await expect(page.getByRole("heading", { name: "notes.txt" })).toBeVisible();
    await goTo("Recent", "Recent");
    await expectRecent(["notes.txt", "photo.png"]);
  });

  await test.step("a trashed file drops out of Recent", async () => {
    await goTo("My Drive", "My Drive");
    await page.getByRole("button", { name: "Actions for photo.png", exact: true }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await expect(page.getByText('"photo.png" moved to trash')).toBeVisible();
    await goTo("Recent", "Recent");
    await expectRecent(["notes.txt"]);
  });

  await db.end();
});
