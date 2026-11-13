import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { testEnv } from "./env";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The admin command (apps/worker/src/admin.ts), run for real against the
// test database and bucket, like worker.spec.ts runs the jobs.
const admin = (args: string[], input?: string) =>
  execFileSync("pnpm", ["--silent", "--filter", "worker", "admin", ...args], {
    env: { ...process.env, ...testEnv() },
    encoding: "utf8",
    input,
    // stderr goes into the thrown error's message instead of the test log.
    stdio: "pipe",
  });

test("admin: reset a password, change roles and quota, invite, remove a user", async ({ page }) => {
  // Nine `pnpm admin` runs: slow on a busy machine.
  test.slow();
  const db = await connectTestDb();
  const email = await test.step("sign up", () => signUpWithOwnInvite(page, db, "admin"));
  const user = async () =>
    (
      await db.query<{ id: string; is_admin: boolean; storage_quota: string }>(
        "select id, is_admin, storage_quota from users where email = $1",
        [email],
      )
    ).rows[0];
  const signIn = async (password: string) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  };

  let fileUrl = "";
  await test.step("upload a file", async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "keep.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("0123456789"),
    });
    await expect(page.getByRole("button", { name: "keep.txt", exact: true })).toBeVisible();
    const [file] = (await db.query<{ id: string }>("select id from items where name = 'keep.txt'"))
      .rows;
    const download = await page.request.get(`/api/items/${file?.id}/download`, {
      maxRedirects: 0,
    });
    fileUrl = download.headers().location ?? "";
    expect((await fetch(fileUrl)).status).toBe(200);
  });

  await test.step("reset-password signs them out; only the new password works", async () => {
    const output = admin(["reset-password", email.toUpperCase()]);
    const password = /New password for .+: (\S+)/.exec(output)?.[1] ?? "";
    expect(password).toHaveLength(20);
    expect(output).toContain("Signed out of 1 session(s).");
    await page.reload();
    await expect(page).toHaveURL("/sign-in");
    await signIn("e2e-password-1");
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await signIn(password);
    await expect(page).toHaveURL("/drive");
  });

  await test.step("set-admin and set-quota", async () => {
    admin(["set-admin", email]);
    expect((await user())?.is_admin).toBe(true);
    admin(["set-admin", email, "--off"]);
    expect((await user())?.is_admin).toBe(false);
    expect(admin(["set-quota", email, "5B"])).toContain("over the new quota");
    expect((await user())?.storage_quota).toBe("5");
    await page.reload();
    await expect(page.getByText("10 B of 5 B used")).toBeVisible();
  });

  await test.step("create-invite for one email", async () => {
    const code = /Invite code: (\S+)/.exec(
      admin(["create-invite", "--email", "New@Example.test"]),
    )?.[1];
    const { rows } = await db.query("select email from invites where code = $1", [code]);
    expect(rows[0]?.email).toBe("new@example.test");
  });

  await test.step("remove-user asks first, then deletes the account and its files", async () => {
    expect(admin(["remove-user", email], "someone-else@example.test\n")).toContain("Cancelled.");
    expect(await user()).toBeDefined();
    const { id } = (await user()) ?? { id: "" };
    expect(admin(["remove-user", email], `${email}\n`)).toContain("and 1 file(s)");
    expect(await user()).toBeUndefined();
    for (const table of [
      "items where owner_id",
      "sessions where user_id",
      "accounts where user_id",
    ]) {
      const { rowCount } = await db.query(`select 1 from ${table} = $1`, [id]);
      expect(rowCount, table).toBe(0);
    }
    expect((await fetch(fileUrl)).status).toBe(404);
    await page.reload();
    await expect(page).toHaveURL("/sign-in");
  });

  await test.step("errors exit with a message", async () => {
    expect(() => admin(["set-admin", email])).toThrow(/No user with the email/);
    expect(() => admin(["set-quota", "x@example.test", "lots"])).toThrow(/Not a size: "lots"/);
  });

  await db.end();
});
