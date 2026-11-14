import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Share links (step 7): Ada makes a link to a folder. Bob opens it signed
// in; Cy opens it signed out, signs in, and comes back to it. Ada changes
// the role and expiry, resets and disables it, and links a file.
test("share links: open, sign-in round trip, role, expiry, reset, disable, file", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const [ada, bob, cy] = await Promise.all(contexts.map((context) => context.newPage()));
  const owner = ada as Page;
  const member = bob as Page;
  const guest = cy as Page;
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-link");
  await signUpWithOwnInvite(member, db, "bob-link");
  const cyEmail = await signUpWithOwnInvite(guest, db, "cy-link");
  // Cy is signed out from here on.
  await contexts[2]?.clearCookies();

  const dialog = owner.getByRole("dialog");
  const linkInput = dialog.getByRole("textbox", { name: "Share link" });
  const openLaunchShare = async () => {
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: 'Share "Launch"' })).toBeVisible();
  };
  const pick = async (menu: string, choice: string) => {
    await dialog.getByRole("button", { name: menu }).click();
    await owner.getByRole("menuitemradio", { name: choice }).click();
  };
  const expectRole = async (page: Page, role: "Viewer" | "Editor") => {
    await expect(page.getByRole("heading", { name: "Launch" })).toBeVisible();
    await expect(page.getByText(`Your role: ${role}`)).toBeVisible();
  };
  const unavailable = (page: Page) =>
    expect(page.getByText("This link no longer works")).toBeVisible();

  let launchUrl = "";
  let link = "";
  await test.step("Ada makes a Viewer link to Launch", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Launch");
    await owner.getByRole("button", { name: "Create" }).click();
    await owner.getByRole("link", { name: "Launch" }).click();
    await expect(owner.getByRole("heading", { name: "Launch" })).toBeVisible();
    launchUrl = new URL(owner.url()).pathname;
    const chooser = owner.waitForEvent("filechooser");
    await owner.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "plan.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plan"),
    });
    await expect(owner.getByRole("button", { name: "plan.txt", exact: true })).toBeVisible();
    await openLaunchShare();
    await dialog.getByRole("button", { name: "Create link" }).click();
    await expect(linkInput).toHaveValue(/\/s\/[A-Za-z0-9_-]{43}$/);
    link = await linkInput.inputValue();
    await expect(dialog.getByText("Opened by 0 people")).toBeVisible();
  });

  await test.step("Bob opens it: Launch, as Viewer, and in Shared with me", async () => {
    await member.goto(link);
    await expectRole(member, "Viewer");
    await member.getByRole("link", { name: "Shared with me" }).first().click();
    await expect(member.getByRole("heading", { name: "Shared with me" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(member.getByRole("row").filter({ hasText: "Launch" })).toContainText("Viewer");
  });

  await test.step("Cy opens it signed out, signs in, and lands on Launch", async () => {
    await guest.goto(link);
    await expect(guest).toHaveURL(/\/sign-in\?next=%2Fs%2F/);
    await guest.getByLabel("Email").fill(cyEmail);
    await guest.getByLabel("Password", { exact: true }).fill("e2e-password-1");
    await guest.getByRole("button", { name: "Sign in", exact: true }).click();
    await expectRole(guest, "Viewer");
  });

  await test.step("Ada makes it an Editor link: the people who opened it are Editors", async () => {
    await owner.keyboard.press("Escape");
    await openLaunchShare();
    await expect(dialog.getByText("Opened by 2 people")).toBeVisible();
    await pick("Link role", "Editor");
    await expect(dialog.getByRole("button", { name: "Link role" })).toHaveText("Editor");
    await member.goto(launchUrl);
    await expectRole(member, "Editor");
  });

  await test.step("expired: access ends and the link stops working, until a new expiry", async () => {
    await db.query(
      "update share_links set expires_at = now() - interval '1 minute' where disabled_at is null and token = $1",
      [link.split("/s/")[1]],
    );
    await member.reload();
    await expect(member.getByText("You need access")).toBeVisible();
    await member.goto(link);
    await unavailable(member);
    await owner.keyboard.press("Escape");
    await openLaunchShare();
    await expect(dialog.getByRole("button", { name: "Link expiry" })).toHaveText("Expired");
    await pick("Link expiry", "Never expires");
    await expect(dialog.getByRole("button", { name: "Link expiry" })).toHaveText("Never expires");
    await member.goto(launchUrl);
    await expectRole(member, "Editor");
  });

  await test.step("reset: a new token; the old one and the access it gave stop", async () => {
    await dialog.getByRole("button", { name: "Reset link" }).click();
    await expect(linkInput).not.toHaveValue(link);
    const newLink = await linkInput.inputValue();
    await member.goto(link);
    await unavailable(member);
    await member.goto(launchUrl);
    await expect(member.getByText("You need access")).toBeVisible();
    await member.goto(newLink);
    await expectRole(member, "Editor");
    link = newLink;
  });

  await test.step("disable: access ends, the link stops working", async () => {
    await dialog.getByRole("button", { name: "Disable link" }).click();
    await expect(dialog.getByRole("button", { name: "Create link" })).toBeVisible();
    await member.goto(launchUrl);
    await expect(member.getByText("You need access")).toBeVisible();
    await member.goto(link);
    await unavailable(member);
    await owner.keyboard.press("Escape");
  });

  await test.step("a file's link opens its preview, and can be removed from Shared with me", async () => {
    await owner.getByRole("button", { name: "Actions for plan.txt", exact: true }).click();
    await owner.getByRole("menuitem", { name: "Share" }).click();
    await expect(dialog.getByRole("heading", { name: 'Share "plan.txt"' })).toBeVisible();
    await dialog.getByRole("button", { name: "Create link" }).click();
    await expect(linkInput).toHaveValue(/\/s\//);
    await member.goto(await linkInput.inputValue());
    await expect(member).toHaveURL(/\/drive\/shared\?file=/);
    await expect(
      member.getByRole("dialog").getByRole("heading", { name: "plan.txt" }),
    ).toBeVisible();
    await member.keyboard.press("Escape");
    await member.getByRole("button", { name: "Actions for plan.txt", exact: true }).click();
    await member.getByRole("menuitem", { name: "Remove from Shared with me" }).click();
    await expect(member.getByText("Nothing shared with you yet")).toBeVisible();
  });

  await test.step("each change and first open was logged", async () => {
    const { rows } = await db.query<{ action: string }>(
      `select a.action from activities a
       join items i on i.id = a.item_id join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'Launch' and a.action like 'link_%'
       order by a.created_at, a.id`,
      [adaEmail],
    );
    expect(rows.map((row) => row.action)).toEqual([
      "link_created",
      "link_opened",
      "link_opened",
      "link_changed",
      "link_changed",
      "link_created",
      "link_opened",
      "link_disabled",
    ]);
  });

  await db.end();
});
