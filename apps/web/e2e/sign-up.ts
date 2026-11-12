import { expect, type Page } from "@playwright/test";
import type pg from "pg";

// Signs up a new user with an invite of their own (auth.spec.ts uses the
// shared one), so each test file starts from a fresh, empty drive.
export const signUpWithOwnInvite = async (page: Page, db: pg.Client, label: string) => {
  const stamp = Date.now();
  const email = `e2e-${label}-${stamp}@example.test`;
  const invite = `E2E-${label.toUpperCase()}-${stamp}`;
  await db.query("insert into invites (code, expires_at) values ($1, now() + interval '1 day')", [
    invite,
  ]);
  await page.goto("/sign-up");
  await page.getByLabel("Invite code").fill(invite);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name").fill(`E2E ${label}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/drive");
  return email;
};
