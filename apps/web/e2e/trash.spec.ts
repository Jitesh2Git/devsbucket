import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

test("trash: undo, Trash view, trashed folder link, restore with rename, delete forever, empty", async ({
  page,
}) => {
  test.slow();
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "trash"));

  const dialog = page.getByRole("alertdialog");
  const folderLink = (name: string) => page.getByRole("link", { name, exact: true });
  const newFolder = async (name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(folderLink(name)).toBeVisible();
  };
  const upload = async (name: string, text: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  };
  const moveToTrash = async (name: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await expect(page.getByText(`"${name}" moved to trash`)).toBeVisible();
  };
  const openTrash = async () => {
    await page.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByRole("heading", { name: "Trash" })).toBeVisible();
  };

  let projectsUrl = "";
  await test.step("a folder with a file in it", async () => {
    await newFolder("Projects");
    await folderLink("Projects").click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    projectsUrl = page.url();
    await upload("plan.md", "# Plan\n");
    await page.getByRole("link", { name: "My Drive" }).first().click();
  });

  await test.step("move to trash, then Undo from the toast", async () => {
    await moveToTrash("Projects");
    await expect(folderLink("Projects")).toBeHidden();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText('Restored "Projects"')).toBeVisible();
    await expect(folderLink("Projects")).toBeVisible();
  });

  await test.step("the Trash lists what was trashed, not what's inside it", async () => {
    await moveToTrash("Projects");
    await openTrash();
    const row = page.getByRole("row", { name: /Projects/ });
    await expect(row).toContainText("My Drive");
    await expect(row).toContainText("30 days");
    await expect(page.getByRole("row", { name: /plan\.md/ })).toHaveCount(0);
  });

  await test.step("the trashed folder's link offers Restore", async () => {
    await page.goto(projectsUrl);
    await expect(page.getByText('"Projects" is in the trash')).toBeVisible();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "plan.md", exact: true })).toBeVisible();
  });

  await test.step("restoring into a taken name renames it, visibly", async () => {
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await moveToTrash("Projects");
    await newFolder("Projects");
    await openTrash();
    await page.getByRole("button", { name: "Restore Projects" }).click();
    await expect(page.getByText('Restored as "Projects (1)"')).toBeVisible();
    await expect(page.getByText("Trash is empty")).toBeVisible();
  });

  await test.step("delete forever frees the space", async () => {
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(page.getByText("7 B of 1 GB used")).toBeVisible();
    await moveToTrash("Projects (1)");
    await openTrash();
    await page.getByRole("button", { name: "Delete Projects (1) forever" }).click();
    await expect(dialog.getByText("This can't be undone.")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByText("Trash is empty")).toBeVisible();
    await expect(page.getByText("0 B of 1 GB used")).toBeVisible();
  });

  await test.step("empty trash", async () => {
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await upload("old.txt", "old\n");
    await moveToTrash("old.txt");
    await moveToTrash("Projects");
    await openTrash();
    await page.getByRole("button", { name: "Empty trash" }).click();
    await dialog.getByRole("button", { name: "Delete forever" }).click();
    await expect(page.getByText("Trash is empty")).toBeVisible();
    await expect(page.getByText("0 B of 1 GB used")).toBeVisible();
  });

  await db.end();
});
