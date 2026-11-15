import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Live editing (Phase 4, step 5): Ada and Bob have the same file open in two
// browsers. Bob starts as a Viewer: he sees Ada's typing and she sees he's
// there, but he can't type. Made an Editor while the file is open, he can.
// Grants are made with SQL, plus the event the app would send.
test("live editing: two people, a Viewer can't type, promoted mid-session, saved", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  const adaEmail = await signUpWithOwnInvite(ada, db, "live-ada");
  const bobEmail = await signUpWithOwnInvite(bob, db, "live-bob");
  const editor = (page: Page) => page.getByRole("code");
  const typeAtEnd = async (page: Page, text: string) => {
    await editor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type(text);
  };

  const fileId = await test.step("Ada uploads a file and Bob is a Viewer", async () => {
    const chooser = ada.waitForEvent("filechooser");
    await ada.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "plan.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("# Plan\n"),
    });
    await expect(ada.getByRole("link", { name: "plan.txt", exact: true })).toBeVisible();
    const { rows } = await db.query<{ id: string }>(
      `select i.id from items i join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'plan.txt'`,
      [adaEmail],
    );
    const id = rows[0]?.id ?? "";
    await db.query(
      `insert into item_permissions (item_id, user_id, role)
       select $1, id, 'viewer' from users where email = $2`,
      [id, bobEmail],
    );
    return id;
  });

  await test.step("both open it; Ada can edit, Bob only watch", async () => {
    await Promise.all([ada.goto(`/drive/files/${fileId}`), bob.goto(`/drive/files/${fileId}`)]);
    await expect(ada.getByRole("status")).toHaveText("All changes saved");
    await expect(bob.getByRole("status")).toHaveText("Read-only: you can view this file");
    await expect(bob.getByRole("button", { name: "Save version" })).toHaveCount(0);
    await expect(bob.getByRole("button", { name: "History" })).toHaveCount(0);
    await expect(editor(bob)).toContainText("# Plan");
    // Each sees the other in "Also here".
    await expect(ada.getByRole("list", { name: "Also here" })).toContainText("E2E live-bob");
    await expect(bob.getByRole("list", { name: "Also here" })).toContainText("E2E live-ada");
  });

  await test.step("Ada's typing appears for Bob; Bob's doesn't go anywhere", async () => {
    await typeAtEnd(ada, "Ada was here");
    await expect(editor(bob)).toContainText("Ada was here");
    await typeAtEnd(bob, "Bob tries");
    await expect(editor(bob)).not.toContainText("Bob tries");
    await expect(editor(ada)).not.toContainText("Bob tries");
  });

  await test.step("made an Editor while it's open, Bob can type", async () => {
    await db.query("update item_permissions set role = 'editor' where item_id = $1", [fileId]);
    const { rows } = await db.query<{ ada: string; bob: string }>(
      `select (select id from users where email = $1) as ada,
              (select id from users where email = $2) as bob`,
      [adaEmail, bobEmail],
    );
    const event = {
      kind: "activity",
      itemId: fileId,
      action: "access_changed",
      actorId: rows[0]?.ada,
      metadata: { userId: rows[0]?.bob, from: "viewer", to: "editor" },
    };
    await db.query("select pg_notify('devsbucket_events', $1)", [JSON.stringify(event)]);
    await expect(bob.getByRole("status")).toHaveText("All changes saved");
    await typeAtEnd(bob, "\nBob too");
    await expect(editor(ada)).toContainText("Bob too");
  });

  await test.step("it's saved: a reload shows both lines", async () => {
    await expect(ada.getByRole("status")).toHaveText("All changes saved");
    await ada.reload();
    await expect(editor(ada)).toContainText("Ada was here");
    await expect(editor(ada)).toContainText("Bob too");
  });

  await test.step("a large file asks before opening", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into items (owner_id, type, name, size, mime_type, storage_key)
       select id, 'file', 'huge.log', 11 * 1024 * 1024, 'text/plain', 'items/huge-' || $2
       from users where email = $1 returning id`,
      [adaEmail, Date.now()],
    );
    await ada.goto(`/drive/files/${rows[0]?.id}`);
    await expect(ada.getByText("This is a large file (11 MB)")).toBeVisible();
    await expect(ada.getByRole("button", { name: "Open in editor" })).toBeVisible();
  });

  await db.end();
});
