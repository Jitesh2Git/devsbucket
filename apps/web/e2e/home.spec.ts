import { expect, test } from "@playwright/test";

// The homepage, for people who aren't signed in (signed-in people go
// straight to their drive: auth.spec.ts). Its demos are pictures of the
// real app, hidden from screen readers; the links are the two ways in.
test("home: what DevsBucket does, and the ways in", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await test.step("the page says what it is", async () => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "One bucket for your files. Room for your whole team.",
    );
    await expect(page.getByRole("heading", { name: "Edit any text file, together" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Share like a drive" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In your bucket in a minute" })).toBeVisible();
    // Everything else, as lists (each row is there twice for the loop, but
    // the copy is hidden).
    await expect(page.getByRole("list", { name: "More features" })).toHaveCount(2);
    await expect(page.getByText("Download a folder as a ZIP")).toHaveCount(2);
  });

  await test.step("the demos are pictures: nothing in them can be used", async () => {
    // The drive window has a table, buttons and a search box, all hidden.
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
    // And none of their buttons can be reached with Tab.
    await expect(page.locator("[inert] button")).not.toHaveCount(0);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[inert]")))).toBe(
        false,
      );
    }
  });

  await test.step("the ways in: sign up with an invite, or sign in", async () => {
    // The header, the top of the page and the end of the page.
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(3);
    await page.getByRole("link", { name: "Sign up with an invite" }).click();
    await expect(page).toHaveURL("/sign-up");
    await expect(page.getByLabel("Invite code")).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Create your account" }).click();
    await expect(page).toHaveURL("/sign-up");

    await page.goto("/");
    await page.getByRole("link", { name: "Sign in", exact: true }).nth(1).click();
    await expect(page).toHaveURL("/sign-in");
  });

  expect(errors).toEqual([]);
});
