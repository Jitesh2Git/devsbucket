import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Every action writes one activity row with the right actor, in the same
// transaction as the change, and queues one notify-activity job (step 4).
test("activity: one row per action with its actor; a refused action writes none", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const owner = await (await browser.newContext()).newPage();
  const editor = await (await browser.newContext()).newPage();
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-log");
  const bobEmail = await signUpWithOwnInvite(editor, db, "bob-log");

  // Activity on Ada's items, oldest first: [action, actor, item, metadata].
  // The item's current name; its old names are in the metadata.
  const rows = async () =>
    (
      await db.query<{
        id: string;
        action: string;
        actor: string | null;
        item: string;
        metadata: object;
      }>(
        `select a.id, a.action, u.email as actor, i.name as item, a.metadata
         from activities a join items i on i.id = a.item_id
         left join users u on u.id = a.actor_id
         where i.owner_id = (select id from users where email = $1)
         order by a.created_at, a.id`,
        [adaEmail],
      )
    ).rows;
  const log = async () =>
    (await rows()).map((row) => [row.action, row.actor, row.item, row.metadata]);
  const activityIds = new Set<string>();
  const idOf = async (name: string) =>
    (await db.query<{ id: string }>("select id from items where name = $1", [name])).rows[0]?.id;
  const openMenu = async (page: Page, name: string, item: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const rename = async (page: Page, from: string, to: string) => {
    await openMenu(page, from, "Rename");
    await page.getByRole("dialog").getByLabel("New name").fill(to);
    await page.getByRole("dialog").getByRole("button", { name: "Rename" }).click();
  };

  await test.step("create a folder and upload a file", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Docs");
    await owner.getByRole("button", { name: "Create" }).click();
    await expect(owner.getByRole("link", { name: "Docs" })).toBeVisible();
    const chooser = owner.waitForEvent("filechooser");
    await owner.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "a.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(owner.getByRole("button", { name: "a.txt", exact: true })).toBeVisible();
  });

  await test.step("rename; a refused rename (name taken) writes nothing", async () => {
    await rename(owner, "a.txt", "b.txt");
    await expect(owner.getByRole("button", { name: "b.txt", exact: true })).toBeVisible();
    await rename(owner, "b.txt", "docs");
    await expect(
      owner.getByText('A file or folder named "docs" already exists here.'),
    ).toBeVisible();
    await owner.keyboard.press("Escape");
  });

  await test.step("move into the folder, download, trash, restore", async () => {
    await openMenu(owner, "b.txt", "Move");
    await owner.getByRole("dialog").getByRole("button", { name: "Docs" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Move here" }).click();
    await expect(owner.getByText("Moved to Docs")).toBeVisible();
    const fileId = await idOf("b.txt");
    expect(
      (await owner.request.get(`/api/items/${fileId}/download`, { maxRedirects: 0 })).status(),
    ).toBe(302);
    await owner.getByRole("link", { name: "Docs" }).click();
    await openMenu(owner, "b.txt", "Move to trash");
    await expect(owner.getByText('"b.txt" moved to trash')).toBeVisible();
    await owner.goto("/drive/trash");
    await owner.getByRole("button", { name: "Restore b.txt" }).click();
    await expect(owner.getByText(/Restored/)).toBeVisible();
  });

  await test.step("an Editor's rename is logged with the Editor as actor", async () => {
    await db.query(
      `insert into item_permissions (item_id, user_id, role)
       select $1, id, 'editor' from users where email = $2`,
      [await idOf("Docs"), bobEmail],
    );
    await editor.goto(`/drive/folders/${await idOf("Docs")}`);
    await rename(editor, "b.txt", "c.txt");
    await expect(editor.getByRole("button", { name: "c.txt", exact: true })).toBeVisible();
  });

  await test.step("one row per action, in order, with its actor", async () => {
    expect(await log()).toEqual([
      ["created", adaEmail, "Docs", {}],
      ["uploaded", adaEmail, "c.txt", { size: 5 }],
      ["renamed", adaEmail, "c.txt", { from: "a.txt", to: "b.txt" }],
      ["moved", adaEmail, "c.txt", { from: null, to: await idOf("Docs") }],
      ["downloaded", adaEmail, "c.txt", {}],
      ["trashed", adaEmail, "c.txt", {}],
      ["restored", adaEmail, "c.txt", { name: "b.txt", movedToTop: false }],
      ["renamed", bobEmail, "c.txt", { from: "b.txt", to: "c.txt" }],
    ]);
    for (const row of await rows()) activityIds.add(row.id);
  });

  await test.step("delete forever is logged on the folder it was in", async () => {
    await owner.goto(`/drive/folders/${await idOf("Docs")}`);
    await openMenu(owner, "c.txt", "Move to trash");
    await expect(owner.getByText('"c.txt" moved to trash')).toBeVisible();
    await owner.goto("/drive/trash");
    await owner.getByRole("button", { name: "Delete c.txt forever" }).click();
    await owner.getByRole("alertdialog").getByRole("button", { name: "Delete forever" }).click();
    await expect(owner.getByText('"c.txt" deleted forever')).toBeVisible();
    // The file's own history went with it; the folder says what happened.
    expect(await log()).toEqual([
      ["created", adaEmail, "Docs", {}],
      ["deleted_forever", adaEmail, "Docs", { name: "c.txt", type: "file" }],
    ]);
    for (const row of await rows()) activityIds.add(row.id);
  });

  await test.step("one notify-activity job per row, queued with it", async () => {
    // The 8 rows checked above, and "deleted_forever" (the second "trashed"
    // went with the file, so it isn't in the set).
    const { rows: jobs } = await db.query<{ activity: string }>(
      `select data->>'activityId' as activity from pgboss.job
       where name = 'notify-activity' and data->>'activityId' = any($1)`,
      [[...activityIds]],
    );
    expect(new Set(jobs.map((job) => job.activity))).toEqual(activityIds);
    expect(jobs).toHaveLength(activityIds.size);
  });

  await db.end();
});
