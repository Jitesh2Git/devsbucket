import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Shared with me (step 6): Ada shares a folder, a file inside it and a file
// outside it with Bob. Bob browses them with his role, works in the folder
// as an Editor (on Ada's quota), uses his Trash, and leaves the folder.
test("shared with me: top-most list, browsing, role-aware buttons, quota, trash, leave", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const member = bob as Page;
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-sw");
  const bobEmail = await signUpWithOwnInvite(member, db, "bob-sw");

  const upload = async (page: Page, name: string, text: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  };
  const openMenu = async (page: Page, name: string, item: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const shareWithBob = async (role: "Editor" | "Viewer") => {
    const dialog = owner.getByRole("dialog");
    await dialog.getByPlaceholder("Email of someone with an account").fill(bobEmail);
    await dialog.getByRole("button", { name: "Role for new person" }).click();
    await owner.getByRole("menuitemradio", { name: role }).click();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByRole("button", { name: `Access for ${bobEmail}` })).toHaveText(role);
    await owner.keyboard.press("Escape");
  };
  const sharedRows = async () => {
    await member.getByRole("link", { name: "Shared with me" }).first().click();
    // Locally the e2e server is `next dev`, which compiles a page on its
    // first visit: no other test opens this one, so allow for that.
    await expect(member.getByRole("heading", { name: "Shared with me" })).toBeVisible({
      timeout: 30_000,
    });
    return member.getByRole("row");
  };
  const storageUsed = async (email: string) =>
    Number(
      (
        await db.query<{ used: string }>(
          "select storage_used as used from users where email = $1",
          [email],
        )
      ).rows[0]?.used,
    );
  // Pages you left stay in the page, hidden (Next's <Activity>), each with
  // its own breadcrumbs: only the visible one counts.
  const breadcrumb = member
    .getByRole("navigation", { name: "breadcrumb" })
    .filter({ visible: true });

  let teamUrl = "";
  await test.step("Ada shares Team and notes.txt as Viewer, plan.txt inside Team as Editor", async () => {
    await upload(owner, "notes.txt", "notes");
    await expect(owner.getByRole("button", { name: "notes.txt", exact: true })).toBeVisible();
    await openMenu(owner, "notes.txt", "Share");
    await shareWithBob("Viewer");
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Team");
    await owner.getByRole("button", { name: "Create" }).click();
    await owner.getByRole("link", { name: "Team" }).click();
    await expect(owner.getByRole("heading", { name: "Team" })).toBeVisible();
    teamUrl = new URL(owner.url()).pathname;
    await upload(owner, "plan.txt", "plan");
    await expect(owner.getByRole("button", { name: "plan.txt", exact: true })).toBeVisible();
    await openMenu(owner, "plan.txt", "Share");
    await shareWithBob("Editor");
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await shareWithBob("Viewer");
  });

  await test.step("Bob's Shared with me lists Team and notes.txt, not what's inside Team", async () => {
    const rows = await sharedRows();
    await expect(rows.filter({ hasText: "Team" })).toContainText("E2E ada-sw");
    await expect(rows.filter({ hasText: "Team" })).toContainText("Viewer");
    await expect(rows.filter({ hasText: "notes.txt" })).toBeVisible();
    await expect(rows.filter({ hasText: "plan.txt" })).toHaveCount(0);
  });

  await test.step("a Viewer browses Team from Shared with me, without changing buttons", async () => {
    await member.getByRole("link", { name: "Team" }).click();
    await expect(member.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Shared with me" })).toBeVisible();
    await expect(breadcrumb.getByText("My Drive")).toHaveCount(0);
    await expect(member.getByText("Your role: Viewer")).toBeVisible();
    await expect(member.getByRole("button", { name: "Upload", exact: true })).toHaveCount(0);
    await breadcrumb.getByRole("link", { name: "Shared with me" }).click();
    await expect(member.getByRole("heading", { name: "Shared with me" })).toBeVisible();
  });

  await test.step("as an Editor: Ada's full drive is named, then the upload uses her quota", async () => {
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await owner
      .getByRole("dialog")
      .getByRole("button", { name: `Access for ${bobEmail}` })
      .click();
    await owner.getByRole("menuitemradio", { name: "Editor" }).click();
    await expect(owner.getByText("E2E bob-sw is now editor")).toBeVisible();
    await owner.keyboard.press("Escape");

    await member.goto(teamUrl);
    await expect(member.getByText("Your role: Editor")).toBeVisible();
    await db.query("update users set storage_quota = storage_used where email = $1", [adaEmail]);
    await upload(member, "bob.txt", "12345");
    await expect(
      member
        .getByRole("region", { name: "Uploads" })
        .getByText("Not enough space in E2E ada-sw's drive."),
    ).toBeVisible();
    await db.query("update users set storage_quota = 1073741824 where email = $1", [adaEmail]);
    const before = await storageUsed(adaEmail);
    await upload(member, "bob.txt", "12345");
    await expect(member.getByRole("button", { name: "bob.txt", exact: true })).toBeVisible();
    expect(await storageUsed(adaEmail)).toBe(before + 5);
    expect(await storageUsed(bobEmail)).toBe(0);
  });

  await test.step("Move stays inside Team", async () => {
    await member.getByRole("button", { name: "New folder" }).click();
    await member.getByLabel("Folder name").fill("Sub");
    await member.getByRole("button", { name: "Create" }).click();
    await expect(member.getByRole("link", { name: "Sub" })).toBeVisible();
    await openMenu(member, "plan.txt", "Move");
    const dialog = member.getByRole("dialog");
    const path = dialog.getByRole("navigation", { name: "Folder path" });
    await expect(path.getByRole("button", { name: "Team" })).toBeVisible();
    await expect(path.getByText("My Drive")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Sub" }).click();
    await dialog.getByRole("button", { name: "Move here" }).click();
    await expect(member.getByText("Moved to Sub")).toBeVisible();
    await member.getByRole("link", { name: "Sub" }).click();
    await expect(member.getByRole("heading", { name: "Sub" })).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Team" })).toBeVisible();
    await expect(member.getByRole("button", { name: "plan.txt", exact: true })).toBeVisible();
    await breadcrumb.getByRole("link", { name: "Team" }).click();
  });

  await test.step("Bob's Trash: what he trashed in Team, restore only", async () => {
    await openMenu(member, "bob.txt", "Move to trash");
    await expect(member.getByText('"bob.txt" moved to trash')).toBeVisible();
    await member.getByRole("link", { name: "Trash" }).click();
    const row = member.getByRole("row").filter({ hasText: "bob.txt" });
    await expect(row).toContainText("You");
    await expect(row.getByRole("button", { name: "Delete bob.txt forever" })).toHaveCount(0);
    await owner.goto("/drive/trash");
    await expect(owner.getByRole("row").filter({ hasText: "bob.txt" })).toContainText("E2E bob-sw");
    await row.getByRole("button", { name: "Restore bob.txt" }).click();
    await expect(member.getByText(/Restored/)).toBeVisible();
    await member.goto(teamUrl);
    await expect(member.getByRole("button", { name: "bob.txt", exact: true })).toBeVisible();
  });

  await test.step("Bob removes Team from Shared with me: plan.txt shows instead", async () => {
    const rows = await sharedRows();
    await member.getByRole("button", { name: "Actions for Team", exact: true }).click();
    await member.getByRole("menuitem", { name: "Remove from Shared with me" }).click();
    await expect(member.getByText('Removed "Team" from Shared with me')).toBeVisible();
    await expect(rows.filter({ hasText: "Team" })).toHaveCount(0);
    await expect(rows.filter({ hasText: "plan.txt" })).toContainText("Editor");
    await member.goto(teamUrl);
    await expect(member.getByText("You need access")).toBeVisible();
  });

  await db.end();
});
