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

  await test.step("the default: Nord with a blue accent, Sora", async () => {
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
