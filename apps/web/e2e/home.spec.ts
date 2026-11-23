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

// The homepage's easter eggs: the bucket, the coins, the file drop, and
// the chip after midnight.
test("home: easter eggs", async ({ page }) => {
  await test.step("tap the bucket: five quick taps fill it to the brim", async () => {
    await page.goto("/");
    const bucket = page.getByRole("button", { name: "The DevsBucket bucket" });
    for (let i = 0; i < 4; i++) await bucket.click();
    await expect(page.getByText("Bucket full. 1 GB of 1 GB used.")).toHaveCount(0);
    await bucket.click();
    await expect(page.getByText("Bucket full. 1 GB of 1 GB used.")).toBeVisible();
    await expect(page.locator(".home-bucket[data-full]")).toHaveCount(1);
    // It settles back.
    await expect(page.locator(".home-bucket[data-full]")).toHaveCount(0);
  });

  await test.step("click the $0: coins fill a little bucket, then tip out", async () => {
    const zero = page.getByRole("button", { name: "$0" });
    await zero.click();
    await expect(page.getByText("Still $0. Promise.")).toBeVisible();
    // Coins have no role; they're drawn in the little bucket.
    const coins = page.locator(".home-coin");
    await expect(coins).toHaveCount(1);
    for (let i = 0; i < 6; i++) await zero.click();
    await expect(coins).toHaveCount(7);
    await expect(page.getByText("That's a lot of coins for a free app.")).toBeVisible();
    await expect(coins).toHaveCount(0);
  });

  await test.step("drag a file over the page: where it would go", async () => {
    const dataTransfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File(["hello"], "notes.md"));
      return data;
    });
    await page.dispatchEvent("body", "dragenter", { dataTransfer });
    await expect(page.getByText("Sign in to drop that in the bucket")).toBeVisible();
    await page.dispatchEvent("body", "drop", { dataTransfer });
    await expect(page.getByText("Sign in to drop that in the bucket")).toHaveCount(0);
    await expect(
      page.getByText("Nice file. Sign in and it goes straight in your bucket."),
    ).toBeVisible();
  });

  await test.step("the chip: a note for night owls", async () => {
    // The browser's own clock, fixed: noon, then 3 a.m.
    await page.clock.setFixedTime(new Date(2026, 10, 24, 12, 0));
    await page.reload();
    await expect(page.getByText("Free, with 1 GB for everyone")).toBeVisible();
    await page.clock.setFixedTime(new Date(2026, 10, 24, 3, 0));
    await page.reload();
    await expect(page.getByText("Coding at 3 a.m.? Same.")).toBeVisible();
  });
});
