import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Notifications (step 11): Ada shares Desk with Bob; Bob's count goes up
// without a reload. Bob uploads three files; Ada gets one batched
// notification. Nobody hears about their own actions.
test("notifications: live count, open one, batching, never your own, mark all read", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const member = bob as Page;
  await signUpWithOwnInvite(owner, db, "ada-note");
  const bobEmail = await signUpWithOwnInvite(member, db, "bob-note");

  const navLink = (page: Page) =>
    page.getByRole("navigation", { name: "Drive" }).getByRole("link", { name: /Notifications/ });
  const openNotifications = async (page: Page) => {
    await navLink(page).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible({
      timeout: 30_000,
    });
  };
  const list = (page: Page) => page.getByRole("list", { name: "Notifications" });
  const upload = async (page: Page, name: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(name) });
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  };

  let deskUrl = "";
  await test.step("Ada shares Desk with Bob: his count goes up, live", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Desk");
    await owner.getByRole("button", { name: "Create" }).click();
    await owner.getByRole("link", { name: "Desk" }).click();
    await expect(owner.getByRole("heading", { name: "Desk" })).toBeVisible();
    deskUrl = new URL(owner.url()).pathname;
    await expect(navLink(member)).toHaveAccessibleName("Notifications");
    const dialog = owner.getByRole("dialog");
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await dialog.getByPlaceholder("Email of someone with an account").fill(bobEmail);
    await dialog.getByRole("button", { name: "Role for new person" }).click();
    await owner.getByRole("menuitemradio", { name: "Editor" }).click();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(navLink(member)).toHaveAccessibleName("Notifications 1 unread");
    await owner.keyboard.press("Escape");
  });

  await test.step("Bob opens it: it's read, and it leads to Desk", async () => {
    await openNotifications(member);
    await expect(list(member)).toContainText(
      'E2E ada-note shared "Desk" with you as editor (unread)',
    );
    await list(member).getByRole("button").first().click();
    await expect(member.getByRole("heading", { name: "Desk" })).toBeVisible();
    await expect(navLink(member)).toHaveAccessibleName("Notifications");
  });

  await test.step("Bob's three uploads make one notification for Ada", async () => {
    for (const name of ["n1.txt", "n2.txt", "n3.txt"]) {
      await upload(member, name);
    }
    await expect(navLink(owner)).toHaveAccessibleName("Notifications 1 unread");
    await openNotifications(owner);
    await expect(list(owner)).toContainText('E2E bob-note added 3 files to "Desk"');
  });

  await test.step("Ada's own upload tells nobody; Mark all as read clears the count", async () => {
    await owner.goto(deskUrl);
    await upload(owner, "ada.txt");
    await openNotifications(owner);
    await expect(list(owner).getByRole("listitem")).toHaveCount(1);
    await owner.getByRole("button", { name: "Mark all as read" }).click();
    await expect(navLink(owner)).toHaveAccessibleName("Notifications");
    await expect(list(owner)).not.toContainText("(unread)");
  });

  await db.end();
});
