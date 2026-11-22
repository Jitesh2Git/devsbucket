import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The 404 page, and the top bar and logo bucket while switching pages.
test("loaders: the terminal 404, and the top bar while switching pages", async ({ page }) => {
  const db = await connectTestDb();
  await test.step("sign up", () => signUpWithOwnInvite(page, db, "loaders"));
  // Animation internals have no role, so these two use their classes.
  const bar = page.locator(".nav-progress-grow, .nav-progress-finish");
  const sloshing = page.locator(".logo-mark[data-loading]");

  await test.step("an unknown address: the terminal 404, with a way back", async () => {
    await page.goto("/drive/no-such-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("HTTP/1.1 404 Not Found")).toBeVisible();
    await expect(page.getByText('"/drive/recent"')).toBeVisible();
    await page.getByRole("link", { name: "Go to My Drive" }).click();
    await expect(page.getByRole("heading", { name: "My Drive" })).toBeVisible();
  });

  await test.step("switching pages: the bar and the bucket show, then go", async () => {
    // Slow the next page down a little, so the loading state can be seen.
    await page.route("**/drive/recent**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    await page.getByRole("link", { name: "Recent" }).click();
    await expect(bar).toHaveCount(1);
    await expect(sloshing).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
    await expect(bar).toHaveCount(0);
    await expect(sloshing).toHaveCount(0);
    await page.unroute("**/drive/recent**");
  });

  await test.step("a link to the same page, or a new tab, starts nothing", async () => {
    await page.getByRole("link", { name: "Recent" }).click();
    await page
      .getByRole("link", { name: "My Drive" })
      .first()
      .click({ modifiers: ["ControlOrMeta"] });
    await expect(bar).toHaveCount(0);
  });
  await db.end();
});
