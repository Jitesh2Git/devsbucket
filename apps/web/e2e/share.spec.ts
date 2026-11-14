import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The Share dialog (step 5): Ada shares a folder with Bob (Editor), Bob
// shares it with Cy (Viewer), Ada changes the settings and Cy's access.
test("sharing: add people, inherited access, settings, change and remove", async ({ browser }) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob, cy] = await Promise.all(
    [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const editor = bob as Page;
  const viewer = cy as Page;
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-share");
  const bobEmail = await signUpWithOwnInvite(editor, db, "bob-share");
  const cyEmail = await signUpWithOwnInvite(viewer, db, "cy-share");

  const dialog = (page: Page) => page.getByRole("dialog");
  const people = (page: Page) => dialog(page).getByRole("list", { name: "People with access" });
  const openShare = async (page: Page) => {
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog(page).getByRole("heading", { name: 'Share "Team"' })).toBeVisible();
  };
  const share = async (page: Page, email: string, role: "Editor" | "Viewer") => {
    await dialog(page).getByPlaceholder("Email of someone with an account").fill(email);
    await dialog(page).getByRole("button", { name: "Role for new person" }).click();
    await page.getByRole("menuitemradio", { name: role }).click();
    await dialog(page).getByRole("button", { name: "Share", exact: true }).click();
  };
  const setAccess = async (page: Page, email: string, choice: string) => {
    await dialog(page)
      .getByRole("button", { name: `Access for ${email}` })
      .click();
    await page
      .getByRole("menuitemradio", { name: choice })
      .or(page.getByRole("menuitem", { name: choice }))
      .click();
  };

  let folderUrl = "";
  await test.step("Ada makes a folder with a file", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Team");
    await owner.getByRole("button", { name: "Create" }).click();
    await owner.getByRole("link", { name: "Team" }).click();
    await expect(owner.getByRole("heading", { name: "Team" })).toBeVisible();
    folderUrl = new URL(owner.url()).pathname;
    const chooser = owner.waitForEvent("filechooser");
    await owner.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "plan.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plan"),
    });
    await expect(owner.getByRole("button", { name: "plan.txt", exact: true })).toBeVisible();
  });

  await test.step("only people with an account, and not the owner", async () => {
    await openShare(owner);
    await share(owner, "nobody@example.test", "Viewer");
    await expect(dialog(owner).getByText("No DevsBucket account uses this email.")).toBeVisible();
    await share(owner, adaEmail, "Viewer");
    await expect(dialog(owner).getByText("They own it.")).toBeVisible();
  });

  await test.step("Ada shares with Bob as Editor", async () => {
    await share(owner, bobEmail, "Editor");
    await expect(owner.getByText("Shared with E2E bob-share")).toBeVisible();
    await expect(dialog(owner).getByRole("button", { name: `Access for ${bobEmail}` })).toHaveText(
      "Editor",
    );
    await owner.keyboard.press("Escape");
  });

  await test.step("the file inside shows Bob's access as inherited", async () => {
    await owner.getByRole("button", { name: "Actions for plan.txt", exact: true }).click();
    await owner.getByRole("menuitem", { name: "Share" }).click();
    await expect(people(owner).getByText("Editor, from Team")).toBeVisible();
    await expect(dialog(owner).getByRole("button", { name: `Access for ${bobEmail}` })).toHaveCount(
      0,
    );
    await owner.keyboard.press("Escape");
  });

  await test.step("Bob, an Editor, shares with Cy as Viewer", async () => {
    await editor.goto(folderUrl);
    await openShare(editor);
    await share(editor, cyEmail, "Viewer");
    await expect(editor.getByText("Shared with E2E cy-share")).toBeVisible();
    // Only the Owner sees the settings.
    await expect(dialog(editor).getByText("Editors can share")).toHaveCount(0);
  });

  await test.step("Cy, a Viewer, has no Share button", async () => {
    await viewer.goto(folderUrl);
    await expect(viewer.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
  });

  await test.step("Ada turns off sharing for Editors: Bob can't share any more", async () => {
    await owner.reload();
    await openShare(owner);
    await dialog(owner).getByLabel("Editors can share").click();
    await expect(owner.getByText("Editors can share: off")).toBeVisible();
    // Bob's dialog is still open from before: the server refuses.
    await share(editor, cyEmail, "Editor");
    await expect(dialog(editor).getByText("You don't have permission to do that.")).toBeVisible();
    await editor.reload();
    await expect(editor.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
  });

  await test.step("Ada makes Cy an Editor, then removes Cy", async () => {
    await setAccess(owner, cyEmail, "Editor");
    await expect(owner.getByText("E2E cy-share is now editor")).toBeVisible();
    await setAccess(owner, cyEmail, "Remove access");
    await expect(owner.getByText("Removed E2E cy-share")).toBeVisible();
    await expect(people(owner).getByText(cyEmail)).toHaveCount(0);
    await viewer.goto(folderUrl);
    await expect(viewer.getByText("You need access")).toBeVisible();
  });

  await test.step("sharing turned off above shows as off below", async () => {
    await owner.keyboard.press("Escape");
    await owner.getByRole("button", { name: "Actions for plan.txt", exact: true }).click();
    await owner.getByRole("menuitem", { name: "Share" }).click();
    await expect(dialog(owner).getByLabel("Editors can share")).not.toBeChecked();
    await expect(dialog(owner).getByLabel("Editors can share")).toBeDisabled();
    await expect(dialog(owner).getByText("Turned off on a folder above.")).toBeVisible();
  });

  await test.step("each change was logged", async () => {
    const { rows } = await db.query<{ action: string }>(
      `select a.action from activities a
       join items i on i.id = a.item_id join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'Team' and a.action <> 'created'
       order by a.created_at, a.id`,
      [adaEmail],
    );
    expect(rows.map((row) => row.action)).toEqual([
      "shared",
      "shared",
      "settings_changed",
      "access_changed",
      "access_removed",
    ]);
  });

  await db.end();
});
