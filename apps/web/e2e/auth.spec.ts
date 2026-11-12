import { expect, test } from "@playwright/test";
import { E2E_INVITE_CODE } from "./env";

// The core account flow, end to end in a real browser: sign up with an
// invite, sign out, sign back in.
test("sign up with an invite, sign out, sign in", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = "e2e-password-1";
  const accountMenu = page.getByRole("button", { name: "Account menu" });

  // Sign up: invite code first, then the account form.
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(E2E_INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  await expect(accountMenu).toBeVisible();

  // Sign out from the account menu.
  await accountMenu.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  // The used invite can't be used again.
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(E2E_INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("This invite code is invalid, used or expired.")).toBeVisible();

  // Sign in: a wrong password first, then the right one.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(accountMenu).toBeVisible();
});
