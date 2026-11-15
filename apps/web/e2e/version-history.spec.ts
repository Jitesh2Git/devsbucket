import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Version history (Phase 4, step 7): Ada saves two named versions, compares
// them, and restores the first; Bob, an Editor with the file open, sees the
// text change without reloading.
test("version history: list, compare, restore for everyone", async ({ browser }) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  const adaEmail = await signUpWithOwnInvite(ada, db, "history-ada");
  const bobEmail = await signUpWithOwnInvite(bob, db, "history-bob");
  const dialog = ada.getByRole("dialog");
  const typeAtEnd = async (text: string) => {
    await ada.getByRole("code").click();
    await ada.keyboard.press("ControlOrMeta+End");
    await ada.keyboard.type(text);
    await expect(ada.getByRole("status")).toHaveText("All changes saved");
  };
  const saveVersion = async (message: string) => {
    await ada.getByRole("button", { name: "Save version" }).click();
    await dialog.getByLabel("What changed").fill(message);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
  };

  const fileId = await test.step("Ada writes two versions; Bob is an Editor", async () => {
    await ada.getByRole("button", { name: "New file" }).click();
    await dialog.getByLabel("File name").fill("plan.md");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(ada.getByRole("status")).toHaveText("All changes saved");
    await typeAtEnd("one");
    await saveVersion("One");
    await typeAtEnd(" two");
    await saveVersion("Two");
    const id = ada.url().split("/").at(-1) ?? "";
    await db.query(
      `insert into item_permissions (item_id, user_id, role)
       select $1, id, 'editor' from users where email = $2`,
      [id, bobEmail],
    );
    return id;
  });

  await test.step("Bob opens it", async () => {
    await bob.goto(`/drive/files/${fileId}`);
    await expect(bob.getByRole("code")).toContainText("one two");
  });

  await test.step("the history lists every version, and compares two", async () => {
    await ada.getByRole("button", { name: "History" }).click();
    const list = dialog.getByRole("list", { name: "Versions" });
    await expect(list.getByRole("button")).toHaveCount(3);
    await expect(list).toContainText("Two");
    await expect(list).toContainText("Original");
    await list.getByRole("button", { name: /^Version 2/ }).click();
    await expect(dialog.getByText("Version 2 compared with")).toBeVisible();
    await dialog.getByRole("combobox").selectOption({ label: "version 3" });
    await expect(dialog.getByRole("code").first()).toBeVisible();
  });

  await test.step("restoring version 2 changes the text for everyone", async () => {
    await dialog.getByRole("button", { name: "Restore version 2" }).click();
    await ada.getByRole("alertdialog").getByRole("button", { name: "Restore" }).click();
    await expect(ada.getByText("Restored version 2 as version 4")).toBeVisible();
    // The dialog closes with an animation; until it's gone it hides the
    // page's editor from the accessibility tree, so getByRole("code") finds
    // the diff's two editors. Wait until only the live editor is left.
    await expect(ada.getByRole("code")).toHaveCount(1);
    await expect(ada.getByRole("code")).not.toContainText("two");
    await expect(bob.getByRole("code")).toContainText("one");
    await expect(bob.getByRole("code")).not.toContainText("two");
    const { rows } = await db.query<{ kind: string }>(
      `select v.kind from item_versions v join items i on i.id = v.item_id
       join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'plan.md' order by v.number desc limit 1`,
      [adaEmail],
    );
    expect(rows[0]?.kind).toBe("restore");
  });

  await db.end();
});
