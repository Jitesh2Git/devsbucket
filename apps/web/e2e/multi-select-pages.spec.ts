import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Multi-select on Recent, Trash and Shared with me (part 4): the same
// clicks as in a folder, with each page's own actions in the bar.
test("multi-select on Recent, Trash and Shared with me", async ({ browser }) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  await signUpWithOwnInvite(ada, db, "ada-pages");
  const bobEmail = await signUpWithOwnInvite(bob, db, "bob-pages");
  const bar = (page: Page) => page.getByRole("toolbar", { name: "Selection" });
  const link = (page: Page, name: string) => page.getByRole("link", { name, exact: true });
  const row = (page: Page, name: string) =>
    page.getByRole("row", { name: new RegExp(`^${name} `) });
  const goTo = async (page: Page, name: string) => {
    await page.getByRole("link", { name }).first().click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  };

  await test.step("Ada has a.txt, b.txt, c.txt and the folders Old, Older, Team", async () => {
    for (const folder of ["Old", "Older", "Team"]) {
      await ada.getByRole("button", { name: "New folder" }).click();
      await ada.getByLabel("Folder name").fill(folder);
      await ada.getByRole("button", { name: "Create" }).click();
      await expect(link(ada, folder)).toBeVisible();
    }
    const chooser = ada.waitForEvent("filechooser");
    await ada.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles(
      ["a.txt", "b.txt", "c.txt"].map((name) => ({
        name,
        mimeType: "text/plain",
        buffer: Buffer.from(name),
      })),
    );
    for (const name of ["a.txt", "b.txt", "c.txt"]) {
      await expect(link(ada, name)).toBeVisible();
    }
  });

  await test.step("Recent: two opened files go to the trash together", async () => {
    for (const name of ["a.txt", "b.txt"]) {
      await link(ada, name).dblclick();
      await expect(ada.getByRole("heading", { name })).toBeVisible();
      await goTo(ada, "My Drive");
    }
    await goTo(ada, "Recent");
    await link(ada, "a.txt").click();
    await link(ada, "b.txt").click({ modifiers: ["ControlOrMeta"] });
    await expect(bar(ada).getByText("2 selected")).toBeVisible();
    await bar(ada).getByRole("button", { name: "Move to trash" }).click();
    await expect(ada.getByText("2 items moved to trash")).toBeVisible();
    await expect(link(ada, "a.txt")).toBeHidden();
    await expect(link(ada, "b.txt")).toBeHidden();
  });

  await test.step("Trash: restore two, delete two forever", async () => {
    await goTo(ada, "My Drive");
    await link(ada, "Old").click();
    await link(ada, "Older").click({ modifiers: ["ControlOrMeta"] });
    await bar(ada).getByRole("button", { name: "Move to trash" }).click();
    await expect(ada.getByText("2 items moved to trash")).toBeVisible();
    await goTo(ada, "Trash");
    await row(ada, "a.txt").click();
    await row(ada, "b.txt").click({ modifiers: ["ControlOrMeta"] });
    await bar(ada).getByRole("button", { name: "Restore" }).click();
    await expect(ada.getByText("Restored 2 items")).toBeVisible();
    await expect(row(ada, "a.txt")).toHaveCount(0);

    await row(ada, "Old").click();
    await row(ada, "Older").click({ modifiers: ["ControlOrMeta"] });
    await bar(ada).getByRole("button", { name: "Delete forever" }).click();
    const confirm = ada.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Delete 2 items forever?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Delete forever" }).click();
    await expect(ada.getByText("2 items deleted forever")).toBeVisible();
    await expect(ada.getByText("Trash is empty")).toBeVisible();
  });

  await test.step("Shared with me: copy the file, then remove both", async () => {
    await goTo(ada, "My Drive");
    await link(ada, "c.txt").click();
    await link(ada, "Team").click({ modifiers: ["ControlOrMeta"] });
    await bar(ada).getByRole("button", { name: "Share" }).click();
    const dialog = ada.getByRole("dialog");
    await dialog.getByPlaceholder("Email or @username").fill(bobEmail);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(ada.getByText(/^Shared 2 items with E2E bob-pages/)).toBeVisible();

    await goTo(bob, "Shared with me");
    await link(bob, "c.txt").click();
    await link(bob, "Team").click({ modifiers: ["ControlOrMeta"] });
    await expect(bar(bob).getByText("2 selected")).toBeVisible();
    // Only files can be copied.
    await expect(bar(bob).getByRole("button", { name: "Make a copy" })).toHaveCount(0);
    await link(bob, "Team").click({ modifiers: ["ControlOrMeta"] });
    await bar(bob).getByRole("button", { name: "Make a copy" }).click();
    await expect(bob.getByText("Copied 1 item")).toBeVisible();

    await link(bob, "c.txt").click();
    await link(bob, "Team").click({ modifiers: ["ControlOrMeta"] });
    await bar(bob).getByRole("button", { name: "Remove from Shared with me" }).click();
    await expect(bob.getByText("Removed 2 items from Shared with me")).toBeVisible();
    await expect(bob.getByText("Nothing shared with you yet")).toBeVisible();
  });

  await db.end();
});
