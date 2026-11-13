import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

test("folders: create, name clash, open, breadcrumbs, load more, 404", async ({ page }) => {
  const stamp = Date.now();
  const db = await connectTestDb();

  // Someone else's folder, to try to open.
  const other = await db.query<{ id: string }>(
    "insert into users (name, email) values ('Other', $1) returning id",
    [`e2e-other-${stamp}@example.test`],
  );
  const secret = await db.query<{ id: string }>(
    "insert into items (owner_id, type, name) values ($1, 'folder', 'Secret') returning id",
    [other.rows[0]?.id],
  );

  const email = await test.step("sign up", () => signUpWithOwnInvite(page, db, "drive"));

  const newFolder = async (name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
  };

  await test.step("create a folder", async () => {
    await newFolder("Projects");
    await expect(page.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  await test.step("a taken name, in any case, is refused on the field", async () => {
    await newFolder("projects");
    await expect(
      page.getByText('A file or folder named "projects" already exists here.'),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  await test.step("open it, create inside, go back up", async () => {
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByText("This folder is empty")).toBeVisible();
    await newFolder("src");
    await expect(page.getByRole("link", { name: "src" })).toBeVisible();
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(page).toHaveURL("/drive");
    await expect(page.getByRole("heading", { name: "My Drive" })).toBeVisible();
  });

  await test.step("50 per page, then Load more", async () => {
    // 60 more folders at the top level: 61 in all.
    await db.query(
      `insert into items (owner_id, type, name)
       select u.id, 'folder', 'Bulk ' || lpad(n::text, 2, '0')
       from users u, generate_series(1, 60) n where u.email = $1`,
      [email],
    );
    await page.reload();
    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(51); // the header + 50
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(rows).toHaveCount(62); // the header + 61
    await expect(page.getByRole("button", { name: "Load more" })).toBeHidden();
    // Sorted by name, ignoring case: "Bulk 01" … "Bulk 60", then "Projects".
    await expect(rows.nth(1)).toContainText("Bulk 01");
    await expect(rows.last()).toContainText("Projects");
  });

  await test.step("someone else's folder says 'You need access'; no folder is a 404", async () => {
    // Decision 0008: it exists, but without its name.
    await page.goto(`/drive/folders/${secret.rows[0]?.id}`);
    await expect(page.getByText("You need access")).toBeVisible();
    await expect(page.getByText("Secret")).toBeHidden();
    await page.goto("/drive/folders/not-a-folder");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });

  await db.end();
});
