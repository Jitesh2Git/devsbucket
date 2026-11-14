import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Roles (steps 3 and 6): the page shows only what the role allows, and the
// server refuses the rest. Grants are made with SQL here. Ada owns a
// folder; Bob gets a role on it; Cy has none.
test("roles: a Viewer opens but can't change, an Editor can, no role sees 'You need access'", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob, cy] = await Promise.all(
    [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
  );
  const adaEmail = await signUpWithOwnInvite(ada as Page, db, "ada");
  const bobEmail = await signUpWithOwnInvite(bob as Page, db, "bob");
  await signUpWithOwnInvite(cy as Page, db, "cy");
  const owner = ada as Page;
  const member = bob as Page;
  const outsider = cy as Page;

  const query = async <T>(text: string, values: unknown[] = []) =>
    (await db.query(text, values)).rows as T[];
  const storageUsed = async (email: string) =>
    Number(
      (
        await query<{ used: string }>("select storage_used as used from users where email = $1", [
          email,
        ])
      )[0]?.used,
    );
  const upload = async (page: Page, name: string, text: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  };
  const openMenu = async (page: Page, name: string, item: string) => {
    await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).click();
  };
  const grant = (role: "editor" | "viewer") =>
    db.query(
      `insert into item_permissions (item_id, user_id, role)
       select $1, id, $2 from users where email = $3
       on conflict (item_id, user_id) do update set role = excluded.role`,
      [folderId, role, bobEmail],
    );

  let folderId = "";
  let fileId = "";
  await test.step("Ada makes a folder with a file", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Team");
    await owner.getByRole("button", { name: "Create" }).click();
    await owner.getByRole("link", { name: "Team" }).click();
    await expect(owner.getByRole("heading", { name: "Team" })).toBeVisible();
    await upload(owner, "plan.txt", "0123456789");
    await expect(owner.getByRole("button", { name: "plan.txt", exact: true })).toBeVisible();
    folderId = owner.url().split("/").at(-1) ?? "";
    fileId =
      (
        await query<{ id: string }>(
          `select i.id from items i join users u on u.id = i.owner_id
           where i.name = 'plan.txt' and u.email = $1`,
          [adaEmail],
        )
      )[0]?.id ?? "";
  });

  await test.step("without a role: 'You need access', and a missing folder is a 404", async () => {
    await outsider.goto(`/drive/folders/${folderId}`);
    await expect(outsider.getByText("You need access")).toBeVisible();
    await expect(outsider.getByText("Team")).toHaveCount(0);
    expect((await outsider.request.get(`/api/items/${fileId}/download`)).status()).toBe(404);
    await outsider.goto(`/drive/folders/${crypto.randomUUID()}`);
    await expect(outsider.getByText("This page could not be found.")).toBeVisible();
  });

  await test.step("a Viewer opens and downloads, and sees nothing that changes", async () => {
    await grant("viewer");
    await member.goto(`/drive/folders/${folderId}`);
    await expect(member.getByRole("button", { name: "plan.txt", exact: true })).toBeVisible();
    await expect(member.getByText("Your role: Viewer")).toBeVisible();
    const download = await member.request.get(`/api/items/${fileId}/download`, {
      maxRedirects: 0,
    });
    expect(download.status()).toBe(302);
    for (const button of ["Upload", "New folder", "Share"]) {
      await expect(member.getByRole("button", { name: button, exact: true })).toHaveCount(0);
    }
    await member.getByRole("button", { name: "Actions for plan.txt", exact: true }).click();
    await expect(member.getByRole("menuitem", { name: "Download" })).toBeVisible();
    for (const item of ["Share", "Rename", "Move", "Move to trash"]) {
      await expect(member.getByRole("menuitem", { name: item, exact: true })).toHaveCount(0);
    }
    await member.keyboard.press("Escape");
  });

  await test.step("an Editor renames, uploads on the owner's quota, and trashes", async () => {
    await grant("editor");
    await member.reload();
    await openMenu(member, "plan.txt", "Rename");
    await member.getByRole("dialog").getByLabel("New name").fill("roadmap.txt");
    await member.getByRole("dialog").getByRole("button", { name: "Rename" }).click();
    await expect(member.getByRole("button", { name: "roadmap.txt", exact: true })).toBeVisible();

    const adaBefore = await storageUsed(adaEmail);
    await upload(member, "bob.txt", "12345");
    await expect(member.getByRole("button", { name: "bob.txt", exact: true })).toBeVisible();
    expect(await storageUsed(adaEmail)).toBe(adaBefore + 5);
    expect(await storageUsed(bobEmail)).toBe(0);
    const [row] = await query<{ owner: string; creator: string }>(
      `select o.email as owner, c.email as creator from items i
       join users o on o.id = i.owner_id join users c on c.id = i.created_by
       where i.name = 'bob.txt' and o.email = $1`,
      [adaEmail],
    );
    expect(row).toEqual({ owner: adaEmail, creator: bobEmail });

    await openMenu(member, "bob.txt", "Move to trash");
    await expect(member.getByText('"bob.txt" moved to trash')).toBeVisible();
    // It's in Ada's trash: her tree, her quota.
    await owner.goto("/drive/trash");
    await expect(owner.getByRole("cell", { name: "bob.txt", exact: true })).toBeVisible();
  });

  await test.step("made a Viewer while the page is open: the server refuses", async () => {
    await grant("viewer");
    // Bob's page still shows the Editor's buttons.
    await openMenu(member, "roadmap.txt", "Rename");
    await member.getByRole("dialog").getByLabel("New name").fill("mine.txt");
    await member.getByRole("dialog").getByRole("button", { name: "Rename" }).click();
    await expect(member.getByText("You don't have permission to do that.")).toBeVisible();
    await member.keyboard.press("Escape");
    await upload(member, "nope.txt", "nope");
    await expect(member.getByText("You don't have permission to do that.")).toBeVisible();
    expect(
      await query(
        `select 1 from items i join users u on u.id = i.owner_id
         where u.email = $1 and i.name in ('nope.txt', 'mine.txt')`,
        [adaEmail],
      ),
    ).toHaveLength(0);
  });

  await db.end();
});
