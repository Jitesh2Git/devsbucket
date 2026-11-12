import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// One file's whole life, end to end (the Phase 2 "done when"): folder,
// upload, preview, rename, move, trash, restore, delete forever, and the
// quota back at 0. The other specs test each part in depth.
test("a file's life: folder, upload, preview, rename, move, trash, restore, delete forever", async ({
  page,
}) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "flow"));

  const myDrive = () => page.getByRole("link", { name: "My Drive" }).first().click();
  const fileButton = (name: string) => page.getByRole("button", { name, exact: true });
  const menu = async (name: string, item: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const newFolder = async (name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  };

  await test.step("two folders", async () => {
    await newFolder("Work");
    await newFolder("Archive");
  });

  await test.step("upload into Work", async () => {
    await page.getByRole("link", { name: "Work", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Work" })).toBeVisible();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "report.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Report\n"),
    });
    await expect(fileButton("report.md")).toBeVisible();
    await expect(page.getByText("9 B of 1 GB used")).toBeVisible();
  });

  await test.step("preview", async () => {
    await fileButton("report.md").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("# Report")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  await test.step("rename", async () => {
    await menu("report.md", "Rename");
    await expect(page.getByLabel("New name")).toBeFocused();
    await page.keyboard.type("summary");
    await page.keyboard.press("Enter");
    await expect(fileButton("summary.md")).toBeVisible();
  });

  await test.step("move into Archive", async () => {
    await menu("summary.md", "Move");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Archive" }).click();
    await dialog.getByRole("button", { name: "Move here" }).click();
    await expect(page.getByText("Moved to Archive")).toBeVisible();
    await expect(fileButton("summary.md")).toBeHidden();
    await myDrive();
    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await expect(fileButton("summary.md")).toBeVisible();
  });

  await test.step("trash, then restore from the Trash", async () => {
    await menu("summary.md", "Move to trash");
    await expect(fileButton("summary.md")).toBeHidden();
    await page.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByRole("row", { name: /summary\.md/ })).toContainText("Archive");
    await page.getByRole("button", { name: "Restore summary.md" }).click();
    await expect(page.getByText('Restored "summary.md"')).toBeVisible();
    await myDrive();
    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await expect(fileButton("summary.md")).toBeVisible();
  });

  await test.step("trash again, delete forever: the space comes back", async () => {
    await menu("summary.md", "Move to trash");
    await page.getByRole("link", { name: "Trash" }).click();
    await page.getByRole("button", { name: "Delete summary.md forever" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByText("Trash is empty")).toBeVisible();
    await expect(page.getByText("0 B of 1 GB used")).toBeVisible();
  });

  await db.end();
});
