import { readFile, writeFile } from "node:fs/promises";
import { expect, type FileChooser, type Page, test } from "@playwright/test";

// Smoke test of a whole running stack (Phase 6): the prod-like one on the
// Mac (https://localhost) or the live site. Unlike e2e/, it starts nothing
// and reads no database: it only uses the site like a person would, with a
// fresh account from an invite made with the admin command. See
// playwright.config.ts here for how to run it.
test("smoke: sign up, upload (60 MB too), live events, live editing, ZIP", async ({ browser }) => {
  test.setTimeout(240_000);
  const invite = process.env.SMOKE_INVITE;
  if (!invite) {
    throw new Error("Set SMOKE_INVITE to an unused invite code");
  }
  const email = `smoke-${Date.now()}@example.test`;
  const password = "smoke-password-1";
  // The same person in two browsers.
  const [a, b] = (await Promise.all(
    [0, 1].map(async () => (await browser.newContext()).newPage()),
  )) as [Page, Page];
  const errors: string[] = [];
  for (const page of [a, b]) {
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  }
  const upload = async (page: Page, files: Parameters<FileChooser["setFiles"]>[0]) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles(files);
  };

  await test.step("sign up in one browser, sign in in the other", async () => {
    await a.goto("/sign-up");
    await a.getByLabel("Invite code").fill(invite);
    await a.getByRole("button", { name: "Continue" }).click();
    await a.getByLabel("Name").fill("Smoke test");
    await a.getByLabel("Email").fill(email);
    await a.getByLabel("Password", { exact: true }).fill(password);
    await a.getByRole("button", { name: "Create account" }).click();
    await expect(a).toHaveURL("/drive");

    await b.goto("/sign-in");
    // Ready for live events once its socket asks for My Drive's changes.
    const subscribed = b
      .waitForEvent("websocket", (socket) => new URL(socket.url()).pathname === "/realtime")
      .then((socket) =>
        socket.waitForEvent("framesent", (frame) => String(frame.payload).includes("subscribe")),
      );
    await b.getByLabel("Email").fill(email);
    await b.getByLabel("Password", { exact: true }).fill(password);
    await b.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(b).toHaveURL("/drive");
    await subscribed;
  });

  await test.step("an upload shows up in the other browser by itself", async () => {
    await upload(a, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello\n") });
    await expect(a.getByRole("link", { name: "notes.txt", exact: true })).toBeVisible();
    // Through the events socket (/realtime), no reload.
    await expect(b.getByRole("link", { name: "notes.txt", exact: true })).toBeVisible();
  });

  await test.step("a 60 MB file uploads in parts, straight to storage", async () => {
    // Playwright only passes files over 50 MB by path.
    const big = test.info().outputPath("big.bin");
    await writeFile(big, Buffer.alloc(60 * 1024 * 1024, 7));
    await upload(a, big);
    await expect(a.getByRole("row", { name: /^big\.bin 60 MB/ })).toBeVisible({
      timeout: 120_000,
    });
  });

  await test.step("typing in one editor appears in the other", async () => {
    await a.getByRole("link", { name: "notes.txt", exact: true }).click();
    await expect(a.getByRole("status")).toHaveText("All changes saved");
    // Through /realtime/collab.
    await b.goto(a.url());
    await expect(b.getByRole("status")).toHaveText("All changes saved");
    await a.getByRole("code").click();
    await a.keyboard.press("ControlOrMeta+End");
    await a.keyboard.insertText("typed live\n");
    await expect(b.getByRole("code")).toContainText("typed live");
  });

  await test.step("a folder downloads as a ZIP", async () => {
    await a.goto("/drive");
    await a.getByRole("button", { name: "New folder" }).click();
    await a.getByLabel("Folder name").fill("Project");
    await a.getByRole("button", { name: "Create" }).click();
    await a.getByRole("link", { name: "Project", exact: true }).click();
    await expect(a.getByRole("heading", { name: "Project" })).toBeVisible();
    await upload(a, { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("alpha") });
    await expect(a.getByRole("link", { name: "a.txt", exact: true })).toBeVisible();
    const download = a.waitForEvent("download");
    await a.getByRole("button", { name: "Download as ZIP" }).click();
    const zip = await readFile((await (await download).path()) ?? "");
    // Stored as is (not compressed), so the file's text is in it.
    expect(zip.includes(Buffer.from("alpha"))).toBe(true);
  });

  expect(errors).toEqual([]);
});
