import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Notification switches and mutes (step 12): Bob works in Ada's Studio.
// With "Files are added" off, or Studio muted, Ada hears nothing; switched
// back on or unmuted, she does. Batching shows it: a notification that
// says "added s2.txt" (not "2 files") means s1.txt made none.
test("notification settings: a switch off, a muted folder, always-on types locked", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const member = bob as Page;
  await signUpWithOwnInvite(owner, db, "ada-mute");
  const bobEmail = await signUpWithOwnInvite(member, db, "bob-mute");

  const upload = async (name: string) => {
    const chooser = member.waitForEvent("filechooser");
    await member.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(name) });
    await expect(member.getByRole("button", { name, exact: true })).toBeVisible();
  };
  const latest = async () => {
    await owner.getByRole("link", { name: /Notifications/ }).click();
    await expect(owner.getByRole("heading", { name: "Notifications" })).toBeVisible({
      timeout: 30_000,
    });
    return owner.getByRole("list", { name: "Notifications" }).getByRole("listitem").first();
  };
  const markAllRead = async () => {
    await owner.getByRole("button", { name: "Mark all as read" }).click();
    await expect(owner.getByRole("link", { name: /Notifications/ })).toHaveAccessibleName(
      "Notifications",
    );
  };
  const toggleMute = async (name: string, menuItem: string) => {
    await owner.getByRole("link", { name: "My Drive" }).first().click();
    await expect(owner.getByRole("heading", { name: "My Drive" })).toBeVisible();
    await owner.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await owner.getByRole("menuitem", { name: menuItem }).click();
  };
  const profileSwitch = (label: string) => owner.getByRole("checkbox", { name: label });

  await test.step("Ada shares Studio with Bob as Editor", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Studio");
    await owner.getByRole("button", { name: "Create" }).click();
    await expect(owner.getByRole("link", { name: "Studio" })).toBeVisible();
    await db.query(
      `insert into item_permissions (item_id, user_id, role)
       select i.id, u.id, 'editor' from items i, users u
       where i.name = 'Studio' and u.email = $1`,
      [bobEmail],
    );
    await member.goto(
      `/drive/folders/${
        (await db.query("select id from items where name = 'Studio'")).rows[0]?.id
      }`,
    );
    await expect(member.getByRole("heading", { name: "Studio" })).toBeVisible();
  });

  await test.step("the profile locks the always-on types", async () => {
    await owner.goto("/profile");
    await expect(profileSwitch("Your access is removed")).toBeChecked();
    await expect(profileSwitch("Your access is removed")).toBeDisabled();
    await expect(profileSwitch("Storage is full")).toBeDisabled();
    // Ada isn't an admin.
    await expect(owner.getByText("Storage operations at 70% of the free tier")).toHaveCount(0);
  });

  await test.step("with Files are added off, Bob's upload tells Ada nothing", async () => {
    await profileSwitch("Files are added").click();
    await expect(owner.getByText("Files are added: off")).toBeVisible();
    await upload("s1.txt");
    await owner.reload();
    await expect(profileSwitch("Files are added")).not.toBeChecked();
    await profileSwitch("Files are added").click();
    await expect(owner.getByText("Files are added: on")).toBeVisible();
    await upload("s2.txt");
    await owner.goto("/drive");
    await expect(await latest()).toContainText('E2E bob-mute added "s2.txt" to "Studio"');
    await markAllRead();
  });

  await test.step("a muted folder is quiet, and so is everything inside it", async () => {
    await toggleMute("Studio", "Mute notifications");
    await expect(owner.getByText('Muted "Studio"')).toBeVisible();
    await member.getByRole("button", { name: "New folder" }).click();
    await member.getByLabel("Folder name").fill("Inner");
    await member.getByRole("button", { name: "Create" }).click();
    await member.getByRole("link", { name: "Inner" }).click();
    await expect(member.getByRole("heading", { name: "Inner" })).toBeVisible();
    await upload("s3.txt");
    // Inside Studio, its menu says so.
    await owner.getByRole("link", { name: "Studio" }).click();
    await owner.getByRole("button", { name: "Actions for Inner", exact: true }).click();
    await expect(owner.getByRole("menuitem", { name: "Muted by a folder above" })).toBeVisible();
    await owner.keyboard.press("Escape");

    await toggleMute("Studio", "Unmute notifications");
    await expect(owner.getByText('Unmuted "Studio"')).toBeVisible();
    await upload("s4.txt");
    await expect(await latest()).toContainText('E2E bob-mute added "s4.txt" to "Inner"');
  });

  await db.end();
});
