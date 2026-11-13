import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The admin page with two people in two browsers: an admin, and a member
// whose account the admin manages.
test("admin page: only for admins; invites, quota, roles, sign-out, password, remove", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const admin = await (await browser.newContext()).newPage();
  const member = await (await browser.newContext()).newPage();
  const adminEmail = await signUpWithOwnInvite(admin, db, "boss");
  const memberEmail = await signUpWithOwnInvite(member, db, "member");
  await db.query("update users set is_admin = true where email = $1", [adminEmail]);

  const userRow = (page: Page, email: string) =>
    page.getByRole("table", { name: "Users" }).getByRole("row").filter({ hasText: email });
  const rowAction = async (email: string, action: string) => {
    await admin.getByRole("button", { name: `Actions for ${email}` }).click();
    await admin.getByRole("menuitem", { name: action, exact: true }).click();
  };

  await test.step("a member sees no Admin link, and /admin doesn't exist for them", async () => {
    await member.getByRole("button", { name: "Account menu" }).click();
    await expect(member.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    await expect(member.getByRole("menuitem", { name: "Admin" })).toHaveCount(0);
    await member.keyboard.press("Escape");
    await member.goto("/admin");
    await expect(member.getByText("This page could not be found.")).toBeVisible();
  });

  await test.step("the admin opens it from the account menu", async () => {
    await admin.reload();
    await admin.getByRole("button", { name: "Account menu" }).click();
    await admin.getByRole("menuitem", { name: "Admin" }).click();
    await expect(admin.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(userRow(admin, adminEmail)).toContainText("(you)");
    await expect(userRow(admin, memberEmail)).toContainText("User");
  });

  await test.step("create an invite for one email, then revoke it", async () => {
    await admin.getByLabel("Only for this email (optional)").fill("Friend@Example.test");
    await admin.getByRole("button", { name: "Create invite" }).click();
    await expect(admin.getByText(/Invite created: /)).toBeVisible();
    const row = admin
      .getByRole("table", { name: "Invites" })
      .getByRole("row")
      .filter({ hasText: "friend@example.test" });
    await expect(row).toContainText("Open");
    const code = (await row.getByRole("cell").first().textContent()) ?? "";
    await row.getByRole("button", { name: `Revoke ${code}` }).click();
    await expect(admin.getByText("Invite revoked")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  await test.step("set the member's quota", async () => {
    await rowAction(memberEmail, "Set quota");
    await admin.getByLabel("Quota", { exact: true }).fill("lots");
    await admin.getByRole("button", { name: "Save" }).click();
    await expect(admin.getByText("Enter a size like 5GB or 500MB")).toBeVisible();
    await admin.getByLabel("Quota", { exact: true }).fill("2GB");
    await admin.getByRole("button", { name: "Save" }).click();
    await expect(userRow(admin, memberEmail)).toContainText("0 B of 2 GB");
  });

  await test.step("make the member an admin, then not", async () => {
    await rowAction(memberEmail, "Make admin");
    await expect(userRow(admin, memberEmail)).toContainText("Admin");
    await rowAction(memberEmail, "Remove admin");
    await expect(userRow(admin, memberEmail)).toContainText("User");
  });

  await test.step("sign the member out everywhere", async () => {
    await rowAction(memberEmail, "Sign out everywhere");
    await expect(admin.getByText(`${memberEmail} was signed out everywhere`)).toBeVisible();
    await member.reload();
    await expect(member).toHaveURL("/sign-in");
  });

  await test.step("reset the member's password; only the new one works", async () => {
    await rowAction(memberEmail, "Reset password");
    await admin.getByRole("button", { name: "Reset password" }).click();
    const password = await admin.getByLabel("New password", { exact: true }).inputValue();
    expect(password).toHaveLength(20);
    await admin.keyboard.press("Escape");
    for (const [attempt, works] of [
      ["e2e-password-1", false],
      [password, true],
    ] as const) {
      await member.getByLabel("Email").fill(memberEmail);
      await member.getByLabel("Password", { exact: true }).fill(attempt);
      await member.getByRole("button", { name: "Sign in", exact: true }).click();
      if (works) {
        await expect(member).toHaveURL("/drive");
      } else {
        await expect(member.getByText("Invalid email or password")).toBeVisible();
      }
    }
  });

  await test.step("an admin can't lock themselves out", async () => {
    await admin.getByRole("button", { name: `Actions for ${adminEmail}` }).click();
    await expect(admin.getByRole("menuitem", { name: "Set quota" })).toBeVisible();
    for (const action of ["Reset password", "Remove admin", "Sign out everywhere", "Remove user"]) {
      await expect(admin.getByRole("menuitem", { name: action })).toHaveCount(0);
    }
    await admin.keyboard.press("Escape");
  });

  await test.step("remove the member, after typing their email", async () => {
    await rowAction(memberEmail, "Remove user");
    const remove = admin.getByRole("button", { name: "Remove forever" });
    await expect(remove).toBeDisabled();
    await admin.getByLabel("Type their email to confirm").fill(memberEmail);
    await remove.click();
    await expect(admin.getByText(`Removed ${memberEmail}`)).toBeVisible();
    await expect(userRow(admin, memberEmail)).toHaveCount(0);
    const { rowCount } = await db.query("select 1 from users where email = $1", [memberEmail]);
    expect(rowCount).toBe(0);
    // Moving to another page (no reload) lands on sign-in, and the header
    // no longer shows their account.
    await member.getByRole("link", { name: "Trash" }).click();
    await expect(member).toHaveURL("/sign-in");
    await expect(member.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    await expect(member.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  });

  await db.end();
});
