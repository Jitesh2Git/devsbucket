import { expect, type Page, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// Ownership transfer (step 9): Ada offers Projects / Garden to Bob, an
// Editor on it. Bob's drive is full at first; then he accepts, and Garden
// lands at the top of his drive (as "Garden (1)": he has a Garden already)
// with its bytes. Ada becomes an Editor. Then an offer cancelled, and one
// declined.
test("ownership transfer: offer, quota refusal, accept, cancel, decline", async ({ browser }) => {
  test.slow();
  const db = await connectTestDb();
  const [ada, bob] = await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  );
  const owner = ada as Page;
  const member = bob as Page;
  const adaEmail = await signUpWithOwnInvite(owner, db, "ada-own");
  const bobEmail = await signUpWithOwnInvite(member, db, "bob-own");

  const dialog = owner.getByRole("dialog").filter({ hasText: "Share" });
  const used = async (email: string) =>
    Number(
      (await db.query("select storage_used from users where email = $1", [email])).rows[0]
        ?.storage_used,
    );
  const newFolder = async (page: Page, name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  };
  const upload = async (page: Page, name: string, text: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  };
  const shareWithBob = async (role: "Editor" | "Viewer") => {
    await dialog.getByPlaceholder("Email of someone with an account").fill(bobEmail);
    await dialog.getByRole("button", { name: "Role for new person" }).click();
    await owner.getByRole("menuitemradio", { name: role }).click();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByRole("button", { name: `Access for ${bobEmail}` })).toHaveText(role);
  };
  const offerToBob = async () => {
    await dialog.getByRole("button", { name: "New owner" }).click();
    await owner.getByRole("menuitemradio", { name: "E2E bob-own" }).click();
    await dialog.getByRole("button", { name: "Offer ownership" }).click();
    const confirm = owner.getByRole("alertdialog");
    await expect(confirm).toContainText("Make E2E bob-own the owner?");
    return confirm;
  };
  const openMenuShare = async (name: string) => {
    await owner.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
    await owner.getByRole("menuitem", { name: "Share" }).click();
    await expect(dialog.getByRole("heading", { name: `Share "${name}"` })).toBeVisible();
  };
  const offers = member.getByRole("list", { name: "Ownership offers" });
  const openShared = async () => {
    await member.getByRole("link", { name: "Shared with me" }).first().click();
    await expect(member.getByRole("heading", { name: "Shared with me" })).toBeVisible({
      timeout: 30_000,
    });
  };

  let gardenUrl = "";
  await test.step("Ada has Projects / Garden / seed.txt, shared with Bob as Editor", async () => {
    await newFolder(member, "Garden");
    await upload(owner, "solo.txt", "solo");
    await newFolder(owner, "Projects");
    await owner.getByRole("link", { name: "Projects" }).click();
    await expect(owner.getByRole("heading", { name: "Projects" })).toBeVisible();
    await newFolder(owner, "Garden");
    await owner.getByRole("link", { name: "Garden" }).click();
    await expect(owner.getByRole("heading", { name: "Garden" })).toBeVisible();
    gardenUrl = new URL(owner.url()).pathname;
    await upload(owner, "seed.txt", "12345678");
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await shareWithBob("Editor");
  });

  await test.step("Ada offers Garden to Bob; the dialog says it leaves its folder", async () => {
    const confirm = await offerToBob();
    await expect(confirm).toContainText("moves out of the folder it's in");
    await confirm.getByRole("button", { name: "Offer ownership" }).click();
    await expect(dialog.getByText("Waiting for E2E bob-own to accept ownership.")).toBeVisible();
    await owner.keyboard.press("Escape");
  });

  await test.step("Bob sees the offer on the folder; his full drive refuses it", async () => {
    await member.goto(gardenUrl);
    await expect(member.getByText("wants to make you the owner of this folder")).toBeVisible();
    await db.query("update users set storage_quota = storage_used where email = $1", [bobEmail]);
    await member.getByRole("button", { name: "Accept ownership of Garden" }).click();
    await expect(
      member.getByText(/Not enough space: .* Free up space to accept it\./),
    ).toBeVisible();
    await db.query("update users set storage_quota = 1073741824 where email = $1", [bobEmail]);
  });

  await test.step("Bob accepts from Shared with me: Garden (1), its bytes, Ada an Editor", async () => {
    const [adaBefore, bobBefore] = [await used(adaEmail), await used(bobEmail)];
    await openShared();
    await expect(offers).toContainText('E2E ada-own wants to make you the owner of "Garden"');
    await offers.getByRole("button", { name: "Accept ownership of Garden" }).click();
    await expect(member.getByText('You own "Garden (1)" now.', { exact: false })).toBeVisible();
    await expect(offers).toHaveCount(0);
    expect([await used(adaEmail), await used(bobEmail)]).toEqual([adaBefore - 8, bobBefore + 8]);
    await member.getByRole("link", { name: "My Drive" }).first().click();
    await expect(member.getByRole("link", { name: "Garden (1)" })).toBeVisible();

    // For Ada it's now someone else's: breadcrumbs start at Shared with me.
    await owner.goto(gardenUrl);
    await expect(owner.getByText("Your role: Editor")).toBeVisible();
    const breadcrumb = owner.getByRole("navigation", { name: "breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Shared with me" })).toBeVisible();
    await owner.getByRole("link", { name: "My Drive" }).first().click();
    await owner.getByRole("link", { name: "Projects" }).click();
    await expect(owner.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(owner.getByText("This folder is empty")).toBeVisible();
  });

  await test.step("an offer can be cancelled, and declined", async () => {
    await owner.getByRole("link", { name: "My Drive" }).first().click();
    await openMenuShare("solo.txt");
    await shareWithBob("Viewer");
    const confirm = await offerToBob();
    await expect(confirm).toContainText("moves to their My Drive");
    await confirm.getByRole("button", { name: "Offer ownership" }).click();
    await dialog.getByRole("button", { name: "Cancel offer" }).click();
    await expect(dialog.getByRole("button", { name: "New owner" })).toBeVisible();
    await openShared();
    await member.reload();
    await expect(offers).toHaveCount(0);

    await (await offerToBob()).getByRole("button", { name: "Offer ownership" }).click();
    await expect(dialog.getByText("Waiting for E2E bob-own")).toBeVisible();
    await member.reload();
    await offers.getByRole("button", { name: "Decline ownership of solo.txt" }).click();
    await expect(member.getByText('Declined "solo.txt"')).toBeVisible();
    await owner.keyboard.press("Escape");
    await openMenuShare("solo.txt");
    await expect(dialog.getByRole("button", { name: "New owner" })).toBeVisible();
  });

  await test.step("the offer and the transfer were logged on Garden", async () => {
    const { rows } = await db.query<{ action: string }>(
      `select a.action from activities a
       join items i on i.id = a.item_id join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'Garden (1)' and a.action like 'ownership_%'
       order by a.created_at, a.id`,
      [bobEmail],
    );
    expect(rows.map((row) => row.action)).toEqual(["ownership_offered", "ownership_transferred"]);
  });

  await db.end();
});
