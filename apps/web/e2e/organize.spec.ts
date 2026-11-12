import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

test("rename and move: keep the extension, name clash, move into a folder, not into itself", async ({
  page,
}) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "organize"));

  const dialog = page.getByRole("dialog");
  const newFolder = async (name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  };
  const openMenu = async (name: string, item: "Rename" | "Move") => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: item }).click();
  };

  await test.step("set up two folders and a file", async () => {
    await newFolder("Docs");
    await newFolder("Archive");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes\n"),
    });
    await expect(page.getByRole("button", { name: "notes.md", exact: true })).toBeVisible();
  });

  await test.step("rename selects the name without its extension", async () => {
    await openMenu("notes.md", "Rename");
    await expect(dialog.getByLabel("New name")).toBeFocused();
    // Typing replaces the selected "notes" and keeps ".md".
    await page.keyboard.type("todo");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "todo.md", exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  await test.step("a taken name is refused on the field", async () => {
    await openMenu("Archive", "Rename");
    await dialog.getByLabel("New name").fill("docs");
    await dialog.getByRole("button", { name: "Rename" }).click();
    await expect(
      dialog.getByText('A file or folder named "docs" already exists here.'),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("move a file into a folder", async () => {
    await openMenu("todo.md", "Move");
    await dialog.getByRole("button", { name: "Docs" }).click();
    await dialog.getByRole("button", { name: "Move here" }).click();
    await expect(page.getByText("Moved to Docs")).toBeVisible();
    await expect(page.getByRole("button", { name: "todo.md", exact: true })).toBeHidden();
    await page.getByRole("link", { name: "Docs", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "todo.md", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "My Drive" }).first().click();
  });

  await test.step("a folder can't be moved into itself", async () => {
    await openMenu("Docs", "Move");
    // Docs is listed but can't be opened as the destination.
    await expect(dialog.getByRole("button", { name: "Docs (this folder)" })).toBeDisabled();
    // Already in My Drive: nothing to do.
    await expect(dialog.getByRole("button", { name: "Move here" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Archive" }).click();
    await dialog.getByRole("button", { name: "Move here" }).click();
    await expect(page.getByText("Moved to Archive")).toBeVisible();
    await expect(page.getByRole("link", { name: "Docs", exact: true })).toBeHidden();
  });

  await db.end();
});
