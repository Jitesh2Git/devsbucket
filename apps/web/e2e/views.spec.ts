import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Folder sizes (what's inside, at any depth) and the Table/Grid toggle,
// remembered per browser and shared by every list.
test("views: folder sizes, grid view remembered across pages and reloads, phone toolbar", async ({
  page,
}) => {
  const db = await connectTestDb();
  const email = await test.step("sign up", () => signUpWithOwnInvite(page, db, "views"));

  await test.step("a folder's size is the files inside it", async () => {
    // Photos (1,000 B) > Trip (24 B), and a file in the trash that doesn't count.
    await db.query(
      `with owner as (select id from users where email = $1),
       photos as (
         insert into items (owner_id, type, name) select id, 'folder', 'Photos' from owner
         returning id, owner_id
       ),
       trip as (
         insert into items (owner_id, parent_id, type, name)
         select owner_id, id, 'folder', 'Trip' from photos returning id, owner_id
       )
       insert into items (owner_id, parent_id, type, name, size, trashed_at, trash_root)
       select owner_id, id, 'file', 'a.jpg', 1000, null::timestamptz, false from photos
       union all select owner_id, id, 'file', 'b.jpg', 24, null, false from trip
       union all select owner_id, id, 'file', 'old.jpg', 5000, now(), true from photos`,
      [email],
    );
    await page.reload();
    await expect(page.getByRole("row", { name: /Photos/ })).toContainText("1 KB");
  });

  const grid = page.getByRole("list", { name: "Files and folders" });

  await test.step("switch to grid: cards with the same details and menu", async () => {
    await page.getByRole("button", { name: "Grid view" }).click();
    await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("table")).toHaveCount(0);
    const card = grid.getByRole("listitem").filter({ hasText: "Photos" });
    await expect(card).toContainText("1 KB");
    await expect(card.getByRole("button", { name: "Actions for Photos" })).toBeVisible();
  });

  await test.step("a card opens the folder, which is a grid too", async () => {
    await grid.getByRole("link", { name: "Photos" }).click();
    await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
    await expect(grid.getByRole("listitem").filter({ hasText: "Trip" })).toContainText("24 B");
  });

  await test.step("remembered after a reload", async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(grid.getByRole("listitem")).toHaveCount(2); // Trip and a.jpg
  });

  await test.step("the Trash follows, with its own buttons on the cards", async () => {
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await page.getByRole("button", { name: "Actions for Photos", exact: true }).click();
    await page.getByRole("menuitem", { name: "Move to trash" }).click();
    await expect(page.getByText('"Photos" moved to trash')).toBeVisible();
    await page.getByRole("link", { name: "Trash", exact: true }).click();
    const cards = page.getByRole("list", { name: "Trash" }).getByRole("listitem");
    // Still 1 KB: what was trashed with it, not old.jpg, trashed before.
    await expect(cards.filter({ hasText: "Photos" })).toContainText("1 KB");
    await expect(cards.filter({ hasText: "old.jpg" })).toContainText("4.9 KB");
    await cards.getByRole("button", { name: "Restore Photos" }).click();
    await expect(cards).toHaveCount(1); // old.jpg
  });

  await test.step("back to the table, everywhere", async () => {
    await page.getByRole("button", { name: "Table view" }).click();
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(page.getByRole("row", { name: /Photos/ })).toContainText("1 KB");
    await expect(grid).toHaveCount(0);
  });

  await test.step("on a phone: no sideways scroll, the actions in one menu", async () => {
    // An unread notification: its badge's hidden " unread" label once
    // stuck out past the nav's sideways scroll and widened the page.
    await db.query(
      `insert into notifications (recipient_id, type)
       select id, 'shared' from users where email = $1`,
      [email],
    );
    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload();
    await expect(page.getByRole("link", { name: /Notifications/ })).toContainText("1");
  });

  await test.step("deep folders: one line, the middle folded into a menu", async () => {
    // From the phone folder: A > B > C > D, then open D.
    const { rows } = await db.query<{ id: string }>(
      `with owner as (select id from users where email = $1),
       a as (insert into items (owner_id, type, name) select id, 'folder', 'Level A' from owner returning id, owner_id),
       b as (insert into items (owner_id, parent_id, type, name) select owner_id, id, 'folder', 'Level B' from a returning id, owner_id),
       c as (insert into items (owner_id, parent_id, type, name) select owner_id, id, 'folder', 'Level C' from b returning id, owner_id)
       insert into items (owner_id, parent_id, type, name) select owner_id, id, 'folder', 'Level D' from c returning id`,
      [email],
    );
    await page.goto(`/drive/folders/${rows[0]?.id}`);
    const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(crumbs.getByRole("heading", { name: "Level D" })).toBeVisible();
    // On a phone: "… › Level D", everything above in the menu.
    await expect(crumbs.getByRole("link", { name: "My Drive" })).toHaveCount(0);
    await expect(crumbs.getByRole("link", { name: "Level C" })).toHaveCount(0);
    await crumbs.getByRole("button", { name: "More folders" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "My Drive",
      "Level A",
      "Level B",
      "Level C",
    ]);
    await page.keyboard.press("Escape");
    // Wider: "My Drive › … › Level C › Level D", A and B in the menu.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(crumbs.getByRole("link", { name: "Level C" })).toBeVisible();
    await expect(crumbs.getByRole("link", { name: "Level A" })).toHaveCount(0);
    await crumbs.getByRole("button", { name: "More folders" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Level A", "Level B"]);
    await page.getByRole("menuitem", { name: "Level A" }).click();
    await expect(page.getByRole("heading", { name: "Level A" })).toBeVisible();
  });
});
