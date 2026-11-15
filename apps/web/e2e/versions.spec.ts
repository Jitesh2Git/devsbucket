import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Versions (Phase 4, step 6, decision 0015): a named version with a
// message, nothing saved when nothing changed, and an automatic version when
// the last person leaves. Each saved version rewrites the file in storage,
// so the download has the new text.
test("versions: named, unchanged, automatic on leave, download updated", async ({ page }) => {
  test.slow();
  const db = await connectTestDb();
  const email = await signUpWithOwnInvite(page, db, "versions");
  const editor = page.getByRole("code");
  const dialog = page.getByRole("dialog");
  const typeAtEnd = async (text: string) => {
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(text);
  };
  const saveVersion = async (message: string) => {
    await page.getByRole("button", { name: "Save version" }).click();
    await dialog.getByLabel("What changed").fill(message);
    await dialog.getByRole("button", { name: "Save" }).click();
  };
  const versions = async () =>
    (
      await db.query<{ number: number; kind: string; message: string | null }>(
        `select v.number, v.kind, v.message from item_versions v
         join items i on i.id = v.item_id join users u on u.id = i.owner_id
         where u.email = $1 and i.name = 'notes.md' order by v.number`,
        [email],
      )
    ).rows;

  await test.step("a new file, typed into", async () => {
    await page.getByRole("button", { name: "New file" }).click();
    await dialog.getByLabel("File name").fill("notes.md");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("status")).toHaveText("All changes saved");
    await typeAtEnd("first draft");
    await expect(page.getByRole("status")).toHaveText("All changes saved");
  });

  await test.step("a named version needs a message, then saves", async () => {
    await page.getByRole("button", { name: "Save version" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Write what changed")).toBeVisible();
    await dialog.getByLabel("What changed").fill("First draft");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved as version 2")).toBeVisible();
    expect(await versions()).toEqual([
      { number: 1, kind: "auto", message: null },
      { number: 2, kind: "named", message: "First draft" },
    ]);
  });

  await test.step("saving again without changes saves nothing", async () => {
    await saveVersion("Same again");
    await expect(page.getByText("Nothing changed since version 2")).toBeVisible();
    expect(await versions()).toHaveLength(2);
  });

  const fileId = page.url().split("/").at(-1) ?? "";
  const download = async () => (await page.request.get(`/api/items/${fileId}/download`)).text();

  await test.step("the download has the named version's text", async () => {
    expect(await download()).toBe("first draft");
  });

  await test.step("more typing, then leaving saves an automatic version", async () => {
    await typeAtEnd(" and more");
    await expect(page.getByRole("status")).toHaveText("All changes saved");
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect.poll(async () => (await versions()).length).toBe(3);
    expect((await versions())[2]).toEqual({ number: 3, kind: "auto", message: null });
    expect(await download()).toBe("first draft and more");
  });

  await db.end();
});
