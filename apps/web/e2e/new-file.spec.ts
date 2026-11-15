import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// New file (Phase 4, step 3): an empty text file, opened in the editor.
test("new file: create and open, name clash, not a text name", async ({ page }) => {
  // Monaco is heavy, and the page loads twice.
  test.slow();
  const db = await connectTestDb();
  const email = await test.step("sign up", () => signUpWithOwnInvite(page, db, "new-file"));
  const dialog = page.getByRole("dialog");

  const newFile = async (name: string) => {
    await page.getByRole("button", { name: "New file" }).click();
    await dialog.getByLabel("File name").fill(name);
    await dialog.getByRole("button", { name: "Create" }).click();
  };

  await test.step("a new file opens in the editor, empty", async () => {
    await newFile("notes.md");
    await expect(page).toHaveURL(/\/drive\/files\//);
    await expect(page.getByRole("heading", { name: "notes.md" })).toBeVisible();
    await expect(page.getByRole("code")).toBeVisible();
    const { rows } = await db.query<{ size: string; status: string }>(
      `select i.size, i.status from items i join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'notes.md'`,
      [email],
    );
    expect(rows).toEqual([{ size: "0", status: "ready" }]);
  });

  await test.step("it's listed, and downloads as an empty file", async () => {
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(
      page.getByRole("table").getByRole("link", { name: "notes.md", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Actions for notes.md", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download" }).click();
    expect((await download).suggestedFilename()).toBe("notes.md");
  });

  await test.step("a taken name, or a name that isn't text, says so", async () => {
    await newFile("NOTES.md");
    await expect(
      dialog.getByText('A file or folder named "NOTES.md" already exists here.'),
    ).toBeVisible();
    await dialog.getByLabel("File name").fill("photo.png");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(
      dialog.getByText("Use a text or code file extension, like .md, .ts or .py"),
    ).toBeVisible();
  });

  await db.end();
});
