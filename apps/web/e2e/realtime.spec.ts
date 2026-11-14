import { request as httpRequest } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { E2E_PORT, E2E_REALTIME_PORT } from "./env";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The status realtime answers a WebSocket handshake with (101 = accepted).
const handshake = (headers: Record<string, string>) =>
  new Promise<number>((resolve, reject) => {
    const request = httpRequest({
      host: "localhost",
      port: E2E_REALTIME_PORT,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        ...headers,
      },
    });
    request.on("upgrade", (response, socket) => {
      socket.destroy();
      resolve(response.statusCode ?? 0);
    });
    request.on("response", (response) => resolve(response.statusCode ?? 0));
    request.on("error", reject);
    request.end();
  });

// Live events (step 10): Ada and Bob both look at Live. What one does shows
// up for the other without reloading; when Ada removes Bob, his page leaves.
test("realtime: live folder changes, access removed, only signed-in pages connect", async ({
  browser,
}) => {
  test.slow();
  const db = await connectTestDb();
  const adaContext = await browser.newContext();
  const [ada, adaHome, bob] = await Promise.all([
    adaContext.newPage(),
    adaContext.newPage(),
    (await browser.newContext()).newPage(),
  ]);
  const owner = ada as Page;
  const home = adaHome as Page;
  const member = bob as Page;
  await signUpWithOwnInvite(owner, db, "ada-live");
  const bobEmail = await signUpWithOwnInvite(member, db, "bob-live");

  const newFolder = async (page: Page, name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
  };

  let liveUrl = "";
  await test.step("Ada shares Live with Bob as Editor; both open it", async () => {
    await newFolder(owner, "Live");
    await owner.getByRole("link", { name: "Live" }).click();
    await expect(owner.getByRole("heading", { name: "Live" })).toBeVisible();
    liveUrl = new URL(owner.url()).pathname;
    await db.query(
      `insert into item_permissions (item_id, user_id, role)
       select $1, id, 'editor' from users where email = $2`,
      [liveUrl.split("/").at(-1), bobEmail],
    );
    await member.goto(liveUrl);
    await expect(member.getByText("This folder is empty")).toBeVisible();
  });

  await test.step("Ada's upload shows up for Bob", async () => {
    const chooser = owner.waitForEvent("filechooser");
    await owner.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hi"),
    });
    await expect(member.getByRole("button", { name: "note.txt", exact: true })).toBeVisible();
  });

  await test.step("Bob's new folder and rename show up for Ada", async () => {
    await newFolder(member, "From Bob");
    await expect(owner.getByRole("link", { name: "From Bob" })).toBeVisible();
    await member.getByRole("button", { name: "Actions for note.txt", exact: true }).click();
    await member.getByRole("menuitem", { name: "Rename" }).click();
    await member.getByRole("dialog").getByLabel("New name").fill("todo.txt");
    await member.getByRole("dialog").getByRole("button", { name: "Rename" }).click();
    await expect(owner.getByRole("button", { name: "todo.txt", exact: true })).toBeVisible();
  });

  await test.step("the top of My Drive is live too, in Ada's other tab", async () => {
    await home.goto("/drive");
    await expect(home.getByRole("link", { name: "Live" })).toBeVisible();
    await owner.getByRole("link", { name: "My Drive" }).first().click();
    await expect(owner.getByRole("heading", { name: "My Drive" })).toBeVisible();
    await newFolder(owner, "Second");
    await expect(home.getByRole("link", { name: "Second" })).toBeVisible();
  });

  await test.step("Ada removes Bob: his page leaves, without a reload", async () => {
    await owner.goto(liveUrl);
    await owner.getByRole("button", { name: "Share", exact: true }).click();
    await owner
      .getByRole("dialog")
      .getByRole("button", { name: `Access for ${bobEmail}` })
      .click();
    await owner.getByRole("menuitem", { name: "Remove access" }).click();
    await expect(member.getByText("You need access")).toBeVisible();
  });

  await test.step("only our own pages, signed in, may connect", async () => {
    const origin = `http://localhost:${E2E_PORT}`;
    const cookie = (await adaContext.cookies())
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    expect(await handshake({ Origin: origin, Cookie: cookie })).toBe(101);
    expect(await handshake({ Origin: origin })).toBe(401);
    expect(await handshake({ Origin: "https://evil.example", Cookie: cookie })).toBe(403);
  });

  await db.end();
});
