import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Access requests (step 8): Bob and Cy open Ada's folder without access and
// ask for it. Ada approves Bob as Viewer and denies Cy.
test("access requests: request, change it, approve with a role, deny", async ({ browser }) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob, cy] = await Promise.all(
    [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const member = bob as Page;
  const other = cy as Page;
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-req");
  const bobEmail = await signUpWithOwnInvite(member, db, "bob-req");
  const cyEmail = await signUpWithOwnInvite(other, db, "cy-req");

  const dialog = owner.getByRole("dialog");
  const requests = dialog.getByRole("list", { name: "Access requests" });
  const openShare = async () => {
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: 'Share "Plans"' })).toBeVisible();
  };
  const ask = async (page: Page, role: "Viewer" | "Editor", message: string) => {
    await page.getByRole("button", { name: "Role to ask for" }).click();
    await page.getByRole("menuitemradio", { name: role }).click();
    await page.getByLabel("Message (optional)").fill(message);
    await page.getByRole("button", { name: "Request access" }).click();
  };

  let plansUrl = "";
  await test.step("Ada makes a folder", async () => {
    await owner.getByRole("button", { name: "New folder" }).click();
    await owner.getByLabel("Folder name").fill("Plans");
    await owner.getByRole("button", { name: "Create" }).click();
    await owner.getByRole("link", { name: "Plans" }).click();
    await expect(owner.getByRole("heading", { name: "Plans" })).toBeVisible();
    plansUrl = new URL(owner.url()).pathname;
  });

  await test.step("Bob asks for Editor, then changes it to Viewer: still one request", async () => {
    await member.goto(plansUrl);
    await expect(member.getByText("You need access")).toBeVisible();
    await ask(member, "Editor", "For the launch");
    await expect(member.getByText(/Request sent for editor access/)).toBeVisible();
    await member.reload();
    await expect(member.getByText(/Request sent for editor access/)).toBeVisible();
    await member.getByRole("button", { name: "Change request" }).click();
    await ask(member, "Viewer", "For the launch");
    await expect(member.getByText(/Request sent for viewer access/)).toBeVisible();
    const { rows } = await db.query(
      `select r.role from access_requests r join users u on u.id = r.requester_id
       where u.email = $1`,
      [bobEmail],
    );
    expect(rows).toEqual([{ role: "viewer" }]);
  });

  await test.step("Ada sees the request and approves Bob as Viewer", async () => {
    await openShare();
    await expect(requests).toContainText("E2E bob-req");
    await expect(requests).toContainText("asks for viewer access");
    await expect(requests).toContainText("For the launch");
    await requests.getByRole("button", { name: `Approve ${bobEmail}` }).click();
    await expect(dialog.getByRole("button", { name: `Access for ${bobEmail}` })).toHaveText(
      "Viewer",
    );
    await expect(requests).toHaveCount(0);
    await member.reload();
    await expect(member.getByRole("heading", { name: "Plans" })).toBeVisible();
    await expect(member.getByText("Your role: Viewer")).toBeVisible();
  });

  await test.step("Cy asks; Ada denies; Cy can ask again", async () => {
    await other.goto(plansUrl);
    await ask(other, "Viewer", "");
    await expect(other.getByText(/Request sent/)).toBeVisible();
    await owner.keyboard.press("Escape");
    await openShare();
    await requests.getByRole("button", { name: `Deny ${cyEmail}` }).click();
    await expect(requests).toHaveCount(0);
    await other.reload();
    await expect(other.getByText("You need access")).toBeVisible();
    await expect(other.getByRole("button", { name: "Request access" })).toBeVisible();
  });

  await test.step("each request and answer was logged", async () => {
    const { rows } = await db.query<{ action: string }>(
      `select a.action from activities a
       join items i on i.id = a.item_id join users u on u.id = i.owner_id
       where u.email = $1 and a.action like 'access_%' order by a.created_at, a.id`,
      [adaEmail],
    );
    expect(rows.map((row) => row.action)).toEqual([
      "access_requested",
      "access_approved",
      "access_requested",
      "access_denied",
    ]);
  });

  await db.end();
});
