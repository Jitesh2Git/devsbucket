import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Make a copy (Phase 5, step 3): next to the original in your own drive,
// numbered when taken, same content, counted in the quota; a Viewer's copy
// goes to the top of their own My Drive; a full drive refuses.
test("make a copy: same folder, numbered, same content, Viewer's copy in their drive, quota", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  const adaEmail = await signUpWithOwnInvite(ada, db, "ada-copy");
  const bobEmail = await signUpWithOwnInvite(bob, db, "bob-copy");

  const upload = async (name: string, text: string) => {
    const chooser = ada.waitForEvent("filechooser");
    await ada.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
    await expect(ada.getByRole("link", { name, exact: true })).toBeVisible();
  };
  const openMenu = async (page: Page, name: string, item: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
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

  await test.step("Ada copies notes.txt twice, next to it, with the same content", async () => {
    await upload("notes.txt", "hello");
    await openMenu(ada, "notes.txt", "Make a copy");
    await expect(ada.getByText('Copied as "notes (copy).txt"')).toBeVisible();
    await expect(ada.getByRole("link", { name: "notes (copy).txt", exact: true })).toBeVisible();
    await openMenu(ada, "notes.txt", "Make a copy");
    await expect(
      ada.getByRole("link", { name: "notes (copy) (1).txt", exact: true }),
    ).toBeVisible();
    expect(await storageUsed(adaEmail)).toBe(15);

    const download = ada.waitForEvent("download");
    await openMenu(ada, "notes (copy).txt", "Download");
    expect(await readFile((await (await download).path()) ?? "", "utf8")).toBe("hello");
  });

  await test.step("Bob, a Viewer of Team, copies plan.txt into his own My Drive", async () => {
    await ada.getByRole("button", { name: "New folder" }).click();
    await ada.getByLabel("Folder name").fill("Team");
    await ada.getByRole("button", { name: "Create" }).click();
    await openMenu(ada, "Team", "Share");
    const share = ada.getByRole("dialog");
    await share.getByPlaceholder("Email or @username").fill(bobEmail);
    await share.getByRole("button", { name: "Share", exact: true }).click();
    await expect(share.getByRole("button", { name: `Access for ${bobEmail}` })).toBeVisible();
    await ada.keyboard.press("Escape");
    await ada.getByRole("link", { name: "Team", exact: true }).dblclick();
    await expect(ada.getByRole("heading", { name: "Team" })).toBeVisible();
    await upload("plan.txt", "plan");

    await bob.getByRole("link", { name: "Shared with me" }).first().click();
    await bob.getByRole("link", { name: "Team", exact: true }).dblclick();
    await expect(bob.getByRole("heading", { name: "Team" })).toBeVisible();
    await openMenu(bob, "plan.txt", "Make a copy");
    await expect(bob.getByText('Copied to your My Drive as "plan (copy).txt"')).toBeVisible();
    await bob.getByRole("link", { name: "My Drive" }).first().click();
    await expect(bob.getByRole("link", { name: "plan (copy).txt", exact: true })).toBeVisible();
    expect(await storageUsed(bobEmail)).toBe(4);
  });

  await test.step("with a full drive, the copy is refused", async () => {
    await db.query("update users set storage_quota = storage_used where email = $1", [bobEmail]);
    await openMenu(bob, "plan (copy).txt", "Make a copy");
    await expect(bob.getByText(/^Not enough space/)).toBeVisible();
    expect(await storageUsed(bobEmail)).toBe(4);
  });

  await db.end();
});
