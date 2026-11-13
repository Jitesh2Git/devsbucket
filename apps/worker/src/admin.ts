// Admin command (LOCKED.md: no email, so an admin resets passwords).
// Runs against whatever DATABASE_URL and S3_* apps/worker/.env points at:
//   pnpm admin reset-password <email>
//   pnpm admin set-admin <email> [--off]
//   pnpm admin set-quota <email> <size>      e.g. 5GB, 500MB
//   pnpm admin create-invite [--email <email>]
//   pnpm admin remove-user <email> [--yes]
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { pool } from "@devsbucket/db/client";
import { createInvite } from "@devsbucket/db/invites";
import { queueStorageCleanup } from "@devsbucket/db/jobs";
import {
  deleteUser,
  findUserByEmail,
  setAdmin,
  setPasswordHash,
  setQuota,
} from "@devsbucket/db/users";
import { formatBytes, parseBytes } from "@devsbucket/shared/bytes";
import { deleteStoredFiles, isComplete } from "@devsbucket/storage/cleanup";
import { generateRandomString, hashPassword } from "better-auth/crypto";

const USAGE = `Usage: pnpm admin <command>
  reset-password <email>           new random password, signs them out everywhere
  set-admin <email> [--off]        make (or stop being) an admin
  set-quota <email> <size>         e.g. 5GB, 500MB
  create-invite [--email <email>]  a 7-day invite code, optionally for one email
  remove-user <email> [--yes]      delete the account and all its files forever`;

class UsageError extends Error {}

const parse = () => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        off: { type: "boolean", default: false },
        email: { type: "string" },
        yes: { type: "boolean", default: false },
      },
    });
  } catch (error) {
    // Unknown flags and the like.
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
};

type Input = ReturnType<typeof parse>["values"] & { args: string[] };

const userFrom = async (email: string | undefined) => {
  if (!email) {
    throw new UsageError("An email is required.");
  }
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`No user with the email ${email}.`);
  }
  return user;
};

const confirm = async (question: string) => {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
};

const commands: Record<string, (input: Input) => Promise<void>> = {
  "reset-password": async ({ args }) => {
    const user = await userFrom(args[0]);
    // 20 characters from 62: about 119 bits, within the 8–128 sign-up rule.
    const password = generateRandomString(20, "a-z", "A-Z", "0-9");
    const result = await setPasswordHash(user.id, await hashPassword(password));
    console.log(`New password for ${user.email}: ${password}`);
    console.log(
      `Signed out of ${result.sessionsRevoked} session(s).${result.addedPassword ? " (They had no password before: GitHub only.)" : ""}`,
    );
    console.log("Send it to them privately; they can change it in Profile.");
  },

  "set-admin": async ({ args, off }) => {
    const user = await userFrom(args[0]);
    await setAdmin(user.id, !off);
    console.log(`${user.email} is ${off ? "no longer" : "now"} an admin.`);
  },

  "set-quota": async ({ args }) => {
    if (!args[1]) {
      throw new UsageError("An email and a size are required.");
    }
    const bytes = parseBytes(args[1]);
    const user = await userFrom(args[0]);
    await setQuota(user.id, bytes);
    console.log(
      `${user.email}: quota ${formatBytes(bytes)}, using ${formatBytes(user.storageUsed)}.`,
    );
    if (user.storageUsed > bytes) {
      console.log("They are over the new quota: uploads are refused until they free up space.");
    }
  },

  "create-invite": async ({ email }) => {
    const invite = await createInvite({ email });
    console.log(`Invite code: ${invite.code}`);
    console.log(
      `Expires ${invite.expiresAt.toISOString()}${invite.email ? `, only for ${invite.email}` : ""}.`,
    );
  },

  "remove-user": async ({ args, yes }) => {
    const user = await userFrom(args[0]);
    if (!yes) {
      console.log(
        `This deletes ${user.email} and everything in their drive (${formatBytes(user.storageUsed)}) forever.`,
      );
      if ((await confirm("Type their email to confirm: ")) !== user.email) {
        console.log("Cancelled.");
        return;
      }
    }
    const cleanup = await deleteUser(user.id);
    // Same path as delete forever: what storage can't delete now goes to
    // the worker's retry queue.
    const failed = await deleteStoredFiles(cleanup);
    if (!isComplete(failed)) {
      await queueStorageCleanup(failed);
    }
    console.log(
      `Removed ${user.email} and ${cleanup.storageKeys.length} file(s)${isComplete(failed) ? "" : ` (${failed.storageKeys.length} queued for retry)`}.`,
    );
  },
};

let exitCode = 0;
try {
  const { positionals, values } = parse();
  const [command, ...args] = positionals;
  const run = command ? commands[command] : undefined;
  if (!run) {
    throw new UsageError(command ? `Unknown command: ${command}` : "");
  }
  await run({ ...values, args });
} catch (error) {
  exitCode = 1;
  if (error instanceof UsageError) {
    if (error.message) {
      console.error(error.message);
    }
    console.error(USAGE);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
} finally {
  await pool.end();
}
// The retry queue's connection (if a delete failed) would keep Node alive.
process.exit(exitCode);
