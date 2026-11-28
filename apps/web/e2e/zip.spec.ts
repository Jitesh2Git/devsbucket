import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { signUpWithOwnInvite } from "./sign-up";
import { connectTestDb } from "./test-db";

// The entries of a ZIP: name -> text (null for a folder). client-zip
// stores files uncompressed, so the central directory at the end of the
// file says where each one's bytes are.
const readZip = (zip: Buffer) => {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries = new Map<string, string | null>();
  for (let i = 0; i < count; i += 1) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString("utf8", at + 46, at + 46 + nameLength);
    expect(method, `${name} is stored, not compressed`).toBe(0);
    const data = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    entries.set(name, name.endsWith("/") ? null : zip.toString("utf8", data, data + size));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

// ZIP download (Phase 5, step 4): a folder with a subfolder, an empty
// folder and files, from the row menu and from the folder page; an empty
// folder and one over the cap say why instead.
test("zip download: the folder's tree with contents; empty and too big are refused", async ({
  page,
}) => {
  test.slow();
  const db = await connectTestDb();
  const email = await signUpWithOwnInvite(page, db, "zip");

  const newFolder = async (name: string) => {
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  };
  const open = async (name: string) => {
    await page.getByRole("link", { name, exact: true }).dblclick();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  };
  const upload = async (name: string, text: string) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  };
  const zipFrom = async (click: () => Promise<void>) => {
    const download = page.waitForEvent("download");
    await click();
    const file = await download;
    return {
      name: file.suggestedFilename(),
      entries: readZip(await readFile((await file.path()) ?? "")),
    };
  };

  await test.step("build Project/a.txt, Project/src/b.ts and Project/src/empty/", async () => {
    await newFolder("Project");
    await open("Project");
    await upload("a.txt", "alpha");
    await newFolder("src");
    await open("src");
    await upload("b.ts", "export const b = 1;");
    await newFolder("empty");
    await page.getByRole("link", { name: "My Drive" }).first().click();
  });

  await test.step("the row menu's Download as ZIP gives the whole tree", async () => {
    const zip = await zipFrom(async () => {
      await page.getByRole("button", { name: "Actions for Project", exact: true }).click();
      await page.getByRole("menuitem", { name: "Download as ZIP" }).click();
    });
    expect(zip.name).toBe("Project.zip");
    // One toast: "Preparing", then what's being downloaded.
    await expect(page.getByText('Downloading "Project.zip"')).toBeVisible();
    await expect(page.getByText("2 files, 24 B. Your browser shows the progress.")).toBeVisible();
    expect(Object.fromEntries(zip.entries)).toEqual({
      "Project/": null,
      "Project/a.txt": "alpha",
      "Project/src/": null,
      "Project/src/b.ts": "export const b = 1;",
      "Project/src/empty/": null,
    });
    const { rows } = await db.query<{ metadata: object }>(
      `select a.metadata from activities a join items i on i.id = a.item_id
       join users u on u.id = i.owner_id
       where u.email = $1 and i.name = 'Project' and a.action = 'downloaded'`,
      [email],
    );
    expect(rows).toEqual([{ metadata: { files: 2 } }]);
  });

  await test.step("the folder page's button gives that folder", async () => {
    await open("Project");
    await open("src");
    const zip = await zipFrom(() => page.getByRole("button", { name: "Download as ZIP" }).click());
    expect([...zip.entries.keys()]).toEqual(["src/", "src/b.ts", "src/empty/"]);
  });

  await test.step("an empty folder and one over the cap say why", async () => {
    await open("empty");
    await page.getByRole("button", { name: "Download as ZIP" }).click();
    await expect(page.getByText("This folder has no files to download.")).toBeVisible();

    await db.query(
      `update items set size = 2 * 1024 * 1024 * 1024::bigint
       where name = 'b.ts' and owner_id = (select id from users where email = $1)`,
      [email],
    );
    await page.getByRole("link", { name: "src", exact: true }).click();
    await expect(page.getByRole("heading", { name: "src" })).toBeVisible();
    await page.getByRole("button", { name: "Download as ZIP" }).click();
    await expect(page.getByText(/^This folder is too big to download as a ZIP/)).toBeVisible();
  });

  await db.end();
});
