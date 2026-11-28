import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The profile: Ada changes her name and picks a username; Bob shares a
// folder with her by typing @username instead of her email.
test("profile: change your name, share by @username", async ({ browser }) => {
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  await signUpWithOwnInvite(ada, db, "profile-ada");
  await signUpWithOwnInvite(bob, db, "profile-bob");
  const username = `ada-${Date.now()}`;

  await test.step("Ada changes her name: the header shows it at once", async () => {
    await ada.goto("/profile");
    await ada.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
    await ada.getByRole("button", { name: "Save" }).first().click();
    await expect(ada.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    await ada.getByRole("button", { name: "Account menu" }).click();
    await expect(ada.getByRole("menu")).toContainText("Ada Lovelace");
    await ada.keyboard.press("Escape");
  });

  await test.step("Ada picks a username", async () => {
    await ada.getByLabel("Username", { exact: true }).fill(username);
    await ada.getByRole("button", { name: "Save" }).nth(1).click();
    await expect(ada.getByText(`@${username}`)).toBeVisible();
  });

  await test.step("Bob shares a folder with @username", async () => {
    await bob.getByRole("button", { name: "New folder" }).click();
    await bob.getByLabel("Folder name").fill("Notes");
    await bob.getByRole("button", { name: "Create" }).click();
    await bob.getByRole("link", { name: "Notes" }).dblclick();
    await bob.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = bob.getByRole("dialog");
    const field = dialog.getByPlaceholder("Email or @username");

    await field.fill(`@nobody-${Date.now()}`);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByText(/No one has the username @nobody-/)).toBeVisible();

    await field.fill(`@${username}`);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(bob.getByText("Shared with Ada Lovelace")).toBeVisible();
    await expect(dialog.getByRole("list", { name: "People with access" })).toContainText(
      `@${username} ·`,
    );
  });
  await db.end();
});
