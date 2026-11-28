import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

test("multi-select: click, Cmd-click, Shift-click, drag a box, then move and trash together", async ({
  page,
}) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "multiselect"));

  const name = (text: string) => page.getByRole("link", { name: text, exact: true });
  const bar = page.getByRole("toolbar", { name: "Selection" });
  const dialog = page.getByRole("dialog");

  await test.step("set up three folders and two files", async () => {
    for (const folder of ["Alpha", "Beta", "Gamma"]) {
      await page.getByRole("button", { name: "New folder" }).click();
      await page.getByLabel("Folder name").fill(folder);
      await page.getByRole("button", { name: "Create" }).click();
      await expect(name(folder)).toBeVisible();
    }
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles([
      { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("a\n") },
      { name: "b.txt", mimeType: "text/plain", buffer: Buffer.from("b\n") },
    ]);
    await expect(name("a.txt")).toBeVisible();
    await expect(name("b.txt")).toBeVisible();
  });

  await test.step("a click selects instead of opening, and the bar takes the buttons' place", async () => {
    await name("a.txt").click();
    await expect(bar.getByText("1 selected")).toBeVisible();
    await expect(page).toHaveURL("/drive");
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeHidden();
    // A plain click on another one selects only that one.
    await name("b.txt").click();
    await expect(bar.getByText("1 selected")).toBeVisible();
  });

  await test.step("Cmd/Ctrl-click adds, Esc clears", async () => {
    await name("a.txt").click({ modifiers: ["ControlOrMeta"] });
    await expect(bar.getByText("2 selected")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeVisible();
  });

  await test.step("Shift-click selects a range, Cmd/Ctrl+A everything", async () => {
    await name("Alpha").click();
    await name("Gamma").click({ modifiers: ["Shift"] });
    await expect(bar.getByText("3 selected")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+a");
    await expect(bar.getByText("5 selected")).toBeVisible();
    await bar.getByRole("button", { name: "Clear selection" }).click();
    await expect(bar).toBeHidden();
  });

  await test.step("a box dragged from the empty space selects what it touches", async () => {
    const table = await page.getByRole("table").boundingBox();
    const first = await page.getByRole("row").nth(1).boundingBox();
    if (!table || !first) throw new Error("no table");
    // From below the last row up to the first row, along the right edge.
    await page.mouse.move(table.x + table.width - 80, table.y + table.height + 30);
    await page.mouse.down();
    await page.mouse.move(table.x + table.width - 60, first.y + 5, { steps: 8 });
    await page.mouse.up();
    await expect(bar.getByText("5 selected")).toBeVisible();
    // A click on the empty space clears.
    await page.mouse.click(table.x + table.width - 80, table.y + table.height + 30);
    await expect(bar).toBeHidden();
  });

  await test.step("Space selects the focused name, Enter and double-click open", async () => {
    await name("Beta").focus();
    await page.keyboard.press("Space");
    await expect(bar.getByText("1 selected")).toBeVisible();
    await expect(name("Beta")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Beta" })).toBeVisible();
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(page).toHaveURL("/drive");
    // Back on the page: nothing is still selected.
    await expect(bar).toBeHidden();
    await name("Gamma").dblclick();
    await expect(page.getByRole("heading", { name: "Gamma" })).toBeVisible();
    await page.getByRole("link", { name: "My Drive" }).first().click();
    await expect(page).toHaveURL("/drive");
  });

  await test.step("move two files into a folder at once", async () => {
    await name("a.txt").click();
    await name("b.txt").click({ modifiers: ["ControlOrMeta"] });
    await bar.getByRole("button", { name: "Move", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Move 2 items" })).toBeVisible();
    await dialog.getByRole("button", { name: "Alpha" }).click();
    await dialog.getByRole("button", { name: "Move here" }).click();
    await expect(page.getByText("Moved to Alpha")).toBeVisible();
    await expect(name("a.txt")).toBeHidden();
    await expect(name("b.txt")).toBeHidden();
    await expect(bar).toBeHidden();
  });

  await test.step("trash two folders at once, then undo", async () => {
    await name("Beta").click();
    await name("Gamma").click({ modifiers: ["ControlOrMeta"] });
    await bar.getByRole("button", { name: "Move to trash" }).click();
    await expect(page.getByText("2 items moved to trash")).toBeVisible();
    await expect(name("Beta")).toBeHidden();
    await expect(name("Gamma")).toBeHidden();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Restored 2 items")).toBeVisible();
    await expect(name("Beta")).toBeVisible();
    await expect(name("Gamma")).toBeVisible();
  });

  await db.end();
});
