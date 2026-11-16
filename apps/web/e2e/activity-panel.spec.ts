import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The activity panel (Phase 5, step 2): Ada uploads, renames, downloads and
// shares a file, then reads it all in its Activity dialog, from the row
// menu and from the file page. Bob, a Viewer, has no Activity.
test("activity panel: the item's log with names, from the menu and the file page; not for Viewers", async ({
  browser,
}) => {
  // The file page (Monaco) loads for both people.
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  await signUpWithOwnInvite(ada, db, "ada-act");
  const bobEmail = await signUpWithOwnInvite(bob, db, "bob-act");
  const dialog = ada.getByRole("dialog");
  const openMenu = async (name: string, item: string) => {
    await ada.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await ada.getByRole("menuitem", { name: item, exact: true }).click();
  };

  await test.step("Ada uploads notes.txt, renames it, downloads it and shares it", async () => {
    const chooser = ada.waitForEvent("filechooser");
    await ada.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(ada.getByRole("link", { name: "notes.txt", exact: true })).toBeVisible();

    await openMenu("notes.txt", "Rename");
    await dialog.getByLabel("New name").fill("plan.txt");
    await ada.keyboard.press("Enter");
    await expect(ada.getByRole("link", { name: "plan.txt", exact: true })).toBeVisible();

    const download = ada.waitForEvent("download");
    await openMenu("plan.txt", "Download");
    await download;

    await openMenu("plan.txt", "Share");
    await dialog.getByPlaceholder("Email of someone with an account").fill(bobEmail);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByRole("button", { name: `Access for ${bobEmail}` })).toBeVisible();
    await ada.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  const expectLog = async () => {
    const log = dialog.getByRole("list", { name: "Activity" }).getByRole("listitem");
    await expect(log).toHaveText([
      /^E2E ada-act shared it with E2E bob-act as Viewer/,
      /^E2E ada-act downloaded it/,
      /^E2E ada-act renamed it from "notes\.txt" to "plan\.txt"/,
      /^E2E ada-act uploaded it/,
    ]);
    await expect(log.first().getByRole("time")).toHaveText("just now");
  };

  await test.step("the row menu's Activity lists it, newest first, with names", async () => {
    await openMenu("plan.txt", "Activity");
    await expect(dialog.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(dialog.getByText("plan.txt", { exact: true })).toBeVisible();
    await expectLog();
    await ada.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  let fileUrl = "";
  await test.step("the file page has the same Activity", async () => {
    await ada.getByRole("link", { name: "plan.txt", exact: true }).click();
    await expect(ada.getByRole("heading", { name: "plan.txt" })).toBeVisible();
    fileUrl = ada.url();
    await ada.getByRole("button", { name: "Activity", exact: true }).click();
    await expectLog();
  });

  await test.step("Bob, a Viewer, has no Activity on the file page", async () => {
    await bob.goto(fileUrl);
    await expect(bob.getByRole("heading", { name: "plan.txt" })).toBeVisible();
    await expect(bob.getByRole("link", { name: "Download" })).toBeVisible();
    await expect(bob.getByRole("button", { name: "Activity", exact: true })).toHaveCount(0);
  });

  await db.end();
});
