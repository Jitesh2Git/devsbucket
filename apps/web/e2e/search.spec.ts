import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Cmd+K search (Phase 5, step 5): Bob finds what Ada shared with him, inside
// a shared folder too, with a typo, but never her private files; Enter opens
// a folder or a text file; recent files show before typing; Ada's image
// opens in the preview.
test("search: shared items by name and with a typo, never private ones; opens each kind", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  await signUpWithOwnInvite(ada, db, "ada-search");
  const bobEmail = await signUpWithOwnInvite(bob, db, "bob-search");

  const upload = async (name: string, mimeType: string) => {
    const chooser = ada.waitForEvent("filechooser");
    await ada.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType, buffer: Buffer.from(name) });
    await expect(ada.getByRole("table").getByText(name, { exact: true })).toBeVisible();
  };
  const search = async (page: Page, text: string) => {
    const dialog = page.getByRole("dialog", { name: "Search" });
    if (!(await dialog.isVisible())) {
      await page.keyboard.press("ControlOrMeta+k");
    }
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox", { name: "Search files and folders" }).fill(text);
    return dialog;
  };

  await test.step("Ada has a private file, a photo, and Team/package.json shared with Bob", async () => {
    await upload("secret-notes.txt", "text/plain");
    await upload("photo.png", "image/png");
    await ada.getByRole("button", { name: "New folder" }).click();
    await ada.getByLabel("Folder name").fill("Team");
    await ada.getByRole("button", { name: "Create" }).click();
    await ada.getByRole("button", { name: "Actions for Team", exact: true }).click();
    await ada.getByRole("menuitem", { name: "Share", exact: true }).click();
    const share = ada.getByRole("dialog");
    await share.getByPlaceholder("Email of someone with an account").fill(bobEmail);
    await share.getByRole("button", { name: "Share", exact: true }).click();
    await expect(share.getByRole("button", { name: `Access for ${bobEmail}` })).toBeVisible();
    await ada.keyboard.press("Escape");
    await ada.getByRole("link", { name: "Team", exact: true }).click();
    await expect(ada.getByRole("heading", { name: "Team" })).toBeVisible();
    await upload("package.json", "application/json");
  });

  await test.step("Bob's empty box points at recent files", async () => {
    await bob.reload();
    const dialog = await search(bob, "");
    await expect(dialog.getByText("Files you open show up here.")).toBeVisible();
  });

  await test.step("a typo finds package.json, in Team, Ada's; her private file isn't found", async () => {
    const dialog = await search(bob, "pakage");
    await expect(dialog.getByRole("option", { name: /package\.json/ })).toContainText(
      "Team · E2E ada-search",
    );
    await search(bob, "secret");
    await expect(dialog.getByText("Nothing found.")).toBeVisible();
    await expect(dialog.getByRole("option")).toHaveCount(0);
  });

  await test.step("Enter opens the folder; a text file opens in the editor", async () => {
    const dialog = await search(bob, "team");
    await expect(dialog.getByRole("option", { name: /^Team/ })).toBeVisible();
    await bob.keyboard.press("Enter");
    await expect(bob.getByRole("heading", { name: "Team" })).toBeVisible();
    await search(bob, "package");
    await bob.getByRole("option", { name: /package\.json/ }).click();
    await expect(bob.getByRole("heading", { name: "package.json" })).toBeVisible();
  });

  await test.step("opened files show in the empty box", async () => {
    const dialog = await search(bob, "");
    await expect(dialog.getByRole("group", { name: "Recent" })).toBeVisible();
    await expect(dialog.getByRole("option", { name: /package\.json/ })).toBeVisible();
    await bob.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  await test.step("the Search button works too, and an image opens in the preview", async () => {
    await ada.getByRole("button", { name: /^Search/ }).click();
    await search(ada, "photo");
    await ada.getByRole("option", { name: /photo\.png/ }).click();
    await expect(ada.getByRole("dialog", { name: "photo.png" })).toBeVisible();
  });

  await db.end();
});
