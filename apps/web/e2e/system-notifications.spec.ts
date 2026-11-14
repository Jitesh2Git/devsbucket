import { execFileSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { testEnv } from "./env";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The worker's jobs, run now against the test database (like worker.spec.ts).
const runJob = (name: "check-alerts" | "trash-warning") =>
  execFileSync("pnpm", ["--filter", "worker", "job", name], {
    env: { ...process.env, ...testEnv() },
    encoding: "utf8",
  });

// System notifications (step 13): someone signs up with Ada's invite; Ada's
// storage crosses 80% (once, however often it's checked); something in her
// trash is about to go; as an admin, she hears about R2 operations.
test("system notifications: invite used, storage 80% once, trash warning, admin R2 alert", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const newcomer = bob as Page;
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-sys");
  const list = owner.getByRole("list", { name: "Notifications" });
  const openNotifications = async () => {
    await owner.goto("/drive/notifications");
    await expect(owner.getByRole("heading", { name: "Notifications" })).toBeVisible({
      timeout: 30_000,
    });
  };

  await test.step("Bob signs up with Ada's invite: Ada hears about it, live", async () => {
    const code = `E2E-ADA-SYS-${Date.now()}`;
    await db.query(
      `insert into invites (code, created_by, expires_at)
       select $1, id, now() + interval '1 day' from users where email = $2`,
      [code, adaEmail],
    );
    await newcomer.goto("/sign-up");
    await newcomer.getByLabel("Invite code").fill(code);
    await newcomer.getByRole("button", { name: "Continue" }).click();
    await newcomer.getByLabel("Name").fill("E2E bob-sys");
    await newcomer.getByLabel("Email").fill(`e2e-bob-sys-${Date.now()}@example.test`);
    await newcomer.getByLabel("Password", { exact: true }).fill("e2e-password-1");
    await newcomer.getByRole("button", { name: "Create account" }).click();
    await expect(newcomer).toHaveURL("/drive");
    await expect(owner.getByRole("link", { name: /Notifications/ })).toHaveAccessibleName(
      "Notifications 1 unread",
    );
    await openNotifications();
    await expect(list).toContainText("E2E bob-sys signed up with your invite");
  });

  await test.step("storage at 85%: told once, however often it's checked", async () => {
    await db.query("update users set storage_quota = 1000, storage_used = 850 where email = $1", [
      adaEmail,
    ]);
    runJob("check-alerts");
    runJob("check-alerts");
    await openNotifications();
    await expect(list.getByText("Your storage is 80% full")).toHaveCount(1);
    await db.query(
      "update users set storage_quota = 1073741824, storage_used = 0 where email = $1",
      [adaEmail],
    );
  });

  await test.step("an item trashed 28 days ago: the warning leads to the Trash", async () => {
    await db.query(
      `insert into items (owner_id, type, name, trash_root, trashed_at)
       select id, 'folder', 'Old drafts', true, now() - interval '28 days'
       from users where email = $1`,
      [adaEmail],
    );
    runJob("trash-warning");
    await openNotifications();
    await list.getByText("1 item in your trash will be deleted forever in 3 days").click();
    await expect(owner.getByRole("heading", { name: "Trash" })).toBeVisible();
    await expect(owner.getByRole("cell", { name: "Old drafts", exact: true })).toBeVisible();
  });

  await test.step("operations at 90% of R2's free tier: admins only", async () => {
    await db.query("update users set is_admin = true where email = $1", [adaEmail]);
    await db.query(
      `insert into usage_counters (month, class_a_ops, class_b_ops)
       values (to_char(now() at time zone 'utc', 'YYYY-MM'), 950000, 0)
       on conflict (month) do update set class_a_ops = 950000`,
    );
    try {
      runJob("check-alerts");
      await openNotifications();
      await expect(list).toContainText("Storage operations this month are at 90% of the free tier");
      const { rows } = await db.query(
        `select count(*)::int as n from notifications n join users u on u.id = n.recipient_id
         where u.name = 'E2E bob-sys' and n.type like 'r2_ops_%'`,
      );
      expect(rows[0]?.n).toBe(0);
    } finally {
      // Later tests upload: at 90% uploads are refused. And the alerts it
      // raised go too, so the next check (or `pnpm test:db`) starts clean.
      await db.query(
        `update usage_counters set class_a_ops = 0, class_b_ops = 0
         where month = to_char(now() at time zone 'utc', 'YYYY-MM')`,
      );
      await db.query("delete from alert_states where key like 'r2_ops_%'");
    }
  });

  await db.end();
});
