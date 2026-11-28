import { expect, type Page, test } from "@playwright/test";
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

  await test.step("Shift-click selects a range, Cmd/Ctrl+A everything; the bar stays on the right", async () => {
    await name("Alpha").click();
    await name("Gamma").click({ modifiers: ["Shift"] });
    await expect(bar.getByText("3 selected")).toBeVisible();
    // The bar sits on the right, at the list's edge, also when the header wraps.
    for (const width of [1280, 1000]) {
      await page.setViewportSize({ width, height: 800 });
      await expect
        .poll(async () => {
          const [barBox, tableBox] = await Promise.all([
            bar.boundingBox(),
            page.getByRole("table").boundingBox(),
          ]);
          return Math.round(
            (tableBox?.x ?? 0) + (tableBox?.width ?? 0) - (barBox?.x ?? 0) - (barBox?.width ?? 0),
          );
        })
        .toBe(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
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

  await test.step("on a phone the bar covers the site header, inside the screen", async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    // A long press is touch; on a phone-sized mouse window a click still selects.
    await name("Alpha").click();
    await expect(bar.getByText("1 selected")).toBeVisible();
    // Whole on screen (once it has slid in), over the 56 px site header.
    await expect(bar).toBeInViewport({ ratio: 1 });
    await expect
      .poll(async () => {
        const box = await bar.boundingBox();
        return (box?.y ?? 99) + (box?.height ?? 0);
      })
      .toBeLessThanOrEqual(56);
    // The page doesn't get wider, and the breadcrumb keeps its room.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    await expect(page.getByRole("heading", { name: "My Drive" })).toBeVisible();
    for (const label of ["Share", "Download", "Move", "Move to trash"]) {
      await expect(bar.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
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

test("multi-select: share several items with one person, never lowering access", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  const adaEmail = await signUpWithOwnInvite(ada, db, "ada-multishare");
  const bobEmail = await signUpWithOwnInvite(bob, db, "bob-multishare");
  const name = (text: string) => ada.getByRole("link", { name: text, exact: true });
  const dialog = ada.getByRole("dialog");
  const share = async (email: string, role: "Editor" | "Viewer") => {
    await dialog.getByPlaceholder("Email or @username").fill(email);
    await dialog.getByRole("button", { name: "Role for new person" }).click();
    await ada.getByRole("menuitemradio", { name: role }).click();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
  };

  await test.step("Ada has Alpha, Beta and c.txt; Bob is already an Editor on Alpha", async () => {
    for (const folder of ["Alpha", "Beta"]) {
      await ada.getByRole("button", { name: "New folder" }).click();
      await ada.getByLabel("Folder name").fill(folder);
      await ada.getByRole("button", { name: "Create" }).click();
      await expect(name(folder)).toBeVisible();
    }
    const chooser = ada.waitForEvent("filechooser");
    await ada.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "c.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("c"),
    });
    await expect(name("c.txt")).toBeVisible();
    await ada.getByRole("button", { name: "Actions for Alpha", exact: true }).click();
    await ada.getByRole("menuitem", { name: "Share", exact: true }).click();
    await share(bobEmail, "Editor");
    await expect(ada.getByText("Shared with E2E bob-multishare")).toBeVisible();
    await ada.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  await test.step("Share from the bar adds Bob to the other two as Viewer", async () => {
    await name("Alpha").click();
    await name("c.txt").click({ modifiers: ["Shift"] });
    const bar = ada.getByRole("toolbar", { name: "Selection" });
    await expect(bar.getByText("3 selected")).toBeVisible();
    await bar.getByRole("button", { name: "Share" }).click();
    await expect(dialog.getByRole("heading", { name: "Share 3 items" })).toBeVisible();
    await share(bobEmail, "Viewer");
    await expect(ada.getByText("Shared 2 items with E2E bob-multishare as viewer")).toBeVisible();
    await expect(ada.getByText("1 item already had this access or more.")).toBeVisible();
    const { rows } = await db.query<{ name: string; role: string }>(
      `select i.name, p.role from item_permissions p join items i on i.id = p.item_id
       join users owner on owner.id = i.owner_id join users member on member.id = p.user_id
       where owner.email = $1 and member.email = $2 order by i.name`,
      [adaEmail, bobEmail],
    );
    expect(rows).toEqual([
      { name: "Alpha", role: "editor" },
      { name: "Beta", role: "viewer" },
      { name: "c.txt", role: "viewer" },
    ]);
  });

  await test.step("Bob sees all three in Shared with me", async () => {
    await bob.getByRole("link", { name: "Shared with me" }).first().click();
    for (const item of ["Alpha", "Beta", "c.txt"]) {
      await expect(bob.getByRole("link", { name: item, exact: true })).toBeVisible();
    }
  });

  await db.end();
});
