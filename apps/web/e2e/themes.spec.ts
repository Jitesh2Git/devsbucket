import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Themes (decision 0018): the default theme is on every page from the
// server; a theme saved in this browser is applied before the first paint.
test("themes: the default, and a saved theme applied on load", async ({ page }) => {
  const db = await connectTestDb();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "themes"));
  const html = page.locator("html");
  const cssVar = (name: string) =>
    page.evaluate(
      (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      name,
    );

  await test.step("the default: a blue accent, Sora", async () => {
    await expect(html).toHaveAttribute("data-button", "solid");
    expect(await cssVar("--light-primary")).toBe("oklch(0.56 0.19 250)");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Sora");
    // The font file was really used, not a fallback.
    expect(await page.evaluate(() => document.fonts.check("16px Sora"))).toBe(true);
  });

  await test.step("a saved theme: Rose with soft buttons, applied on load", async () => {
    await page.evaluate(() =>
      localStorage.setItem(
        "devsbucket:theme",
        JSON.stringify({
          theme: "rose",
          accentHue: null,
          greys: null,
          fontSans: null,
          button: "soft",
        }),
      ),
    );
    await page.reload();
    await expect(page.getByRole("heading", { name: "My Drive" })).toBeVisible();
    await expect(html).toHaveAttribute("data-button", "soft");
    expect(await cssVar("--light-primary")).toBe("oklch(0.59 0.22 12)");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      "Outfit",
    );
  });

  // No hydration warnings from the attributes the script set.
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  await db.end();
});

// The Themes page: pick a theme, change it, and it's remembered; Reset goes
// back to the default.
test("themes page: pick, customise, remembered, reset", async ({ page }) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "themes-page"));
  const html = page.locator("html");
  const cssVar = (name: string) =>
    page.evaluate(
      (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
      name,
    );
  const theme = (name: string) => page.getByRole("button", { name, exact: true });
  const option = (group: string, name: string) =>
    page.getByRole("group", { name: group }).getByRole("button", { name, exact: true });

  const reset = page.getByRole("button", { name: "Reset to default" });
  const inUseDefault = page.getByText("In use: Default.");

  await test.step("open it from the account menu: the default is in use, not a card", async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Themes" }).click();
    await expect(page.getByRole("heading", { name: "Themes", exact: true })).toBeVisible();
    await expect(inUseDefault).toBeVisible();
    await expect(theme("Default")).toHaveCount(0);
    await expect(theme("Nord")).toHaveAttribute("aria-pressed", "false");
    await expect(reset).toBeDisabled();
  });

  await test.step("pick Rose: the whole app changes at once", async () => {
    await theme("Rose").click();
    await expect(theme("Rose")).toHaveAttribute("aria-pressed", "true");
    expect(await cssVar("--light-primary")).toBe("oklch(0.59 0.22 12)");
  });

  await test.step("customise: outline buttons, Inter, remembered after a reload", async () => {
    await option("Main button", "Outline").click();
    await expect(html).toHaveAttribute("data-button", "outline");
    await page.getByRole("combobox", { name: "Text font" }).click();
    await page.getByRole("option", { name: "Inter" }).click();
    await page.reload();
    await expect(theme("Rose")).toHaveAttribute("aria-pressed", "true");
    await expect(html).toHaveAttribute("data-button", "outline");
    await expect(option("Main button", "Outline")).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      "Inter",
    );
  });

  await test.step("Reset to default", async () => {
    await reset.click();
    await expect(inUseDefault).toBeVisible();
    await expect(theme("Rose")).toHaveAttribute("aria-pressed", "false");
    await expect(reset).toBeDisabled();
    await expect(html).toHaveAttribute("data-button", "solid");
    expect(await cssVar("--light-primary")).toBe("oklch(0.56 0.19 250)");
    expect(await page.evaluate(() => localStorage.getItem("devsbucket:theme"))).toBeNull();
  });
  await db.end();
});

// Monaco draws text with its own font list, so it's handed the theme's
// code font, and follows when another one is picked (here, from a second
// tab).
test("themes: the editor uses the theme's code font, and follows a change", async ({ page }) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "themes-code"));
  const editorFont = () =>
    page
      .getByRole("code")
      .evaluate((el) => getComputedStyle(el.querySelector(".view-line") ?? el).fontFamily);

  await test.step("a new file opens in Fira Code, the default", async () => {
    await page.getByRole("button", { name: "New file" }).click();
    await page.getByRole("dialog").getByLabel("File name").fill("notes.ts");
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("status")).toHaveText("All changes saved");
    await expect.poll(editorFont).toContain("Fira Code");
  });

  await test.step("another tab picks JetBrains Mono: the open editor follows", async () => {
    const other = await page.context().newPage();
    await other.goto("/themes");
    await other.getByRole("combobox", { name: "Code font" }).click();
    await other.getByRole("option", { name: "JetBrains Mono" }).click();
    await expect.poll(editorFont).toContain("JetBrains Mono");
    await other.close();
  });
  await db.end();
});
