import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Markdown preview (Phase 4, step 8): Ada writes a .md file in the Split
// view; Bob, a Viewer, starts on the preview and sees it follow her typing.
// Raw HTML is shown as text, never run.
test("markdown preview: live, GitHub extras, no raw HTML, views", async ({ browser }) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  await signUpWithOwnInvite(ada, db, "md-ada");
  const bobEmail = await signUpWithOwnInvite(bob, db, "md-bob");
  for (const page of [ada, bob]) {
    page.on("dialog", () => {
      throw new Error("A script from the Markdown ran");
    });
  }
  const preview = (page: Page) => page.getByRole("region", { name: "Preview" });

  await test.step("Ada makes readme.md and shares it with Bob as Viewer", async () => {
    await ada.getByRole("button", { name: "New file" }).click();
    await ada.getByRole("dialog").getByLabel("File name").fill("readme.md");
    await ada.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(ada.getByRole("status")).toHaveText("All changes saved");
    const fileId = ada.url().split("/").at(-1) ?? "";
    await db.query(
      `insert into item_permissions (item_id, user_id, role)
       select $1, id, 'viewer' from users where email = $2`,
      [fileId, bobEmail],
    );
    await bob.goto(`/drive/files/${fileId}`);
    await expect(bob.getByRole("status")).toHaveText("Read-only: you can view this file");
  });

  await test.step("Ada sees Split; Bob starts on the preview", async () => {
    await expect(ada.getByRole("button", { name: "Split", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(bob.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(bob.getByRole("code")).toBeHidden();
  });

  await test.step("the preview follows Ada's typing, for both", async () => {
    await ada.getByRole("code").click();
    await ada.keyboard.insertText(
      [
        "# Plan",
        "",
        "| Task | Done |",
        "| --- | --- |",
        "| ship | yes |",
        "",
        "- [x] write",
        "",
        "<script>alert(1)</script>",
      ].join("\n"),
    );
    for (const page of [ada, bob]) {
      await expect(preview(page).getByRole("heading", { name: "Plan" })).toBeVisible();
      await expect(preview(page).getByRole("cell", { name: "ship" })).toBeVisible();
      await expect(preview(page).getByRole("checkbox")).toBeChecked();
      await expect(preview(page).getByText("<script>alert(1)</script>")).toBeVisible();
    }
  });

  await test.step("Editor hides the preview; Preview hides the editor", async () => {
    await ada.getByRole("button", { name: "Editor", exact: true }).click();
    await expect(preview(ada)).toHaveCount(0);
    await expect(ada.getByRole("code")).toBeVisible();
    await ada.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(preview(ada)).toBeVisible();
    await expect(ada.getByRole("code")).toBeHidden();
  });

  await test.step("a long text with a footnote doesn't stretch the page", async () => {
    // GitHub footnotes add an sr-only (absolutely placed) heading after the
    // text; outside a positioned preview it made the whole page scroll.
    await ada.getByRole("button", { name: "Split", exact: true }).click();
    await ada.getByRole("code").click();
    await ada.keyboard.press("ControlOrMeta+End");
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}.`);
    await ada.keyboard.insertText(
      ["", "", ...paragraphs, "", "A note.[^1]", "", "[^1]: The footnote."].join("\n\n"),
    );
    await expect(preview(ada).getByText("The footnote.")).toBeAttached();
    expect(
      await ada.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
    ).toBeLessThanOrEqual(1);
  });

  await db.end();
});
