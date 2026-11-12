---
name: step-scratch
description: Build and test the next DevsBucket step in a throwaway copy of the repo (with its own Postgres) before explaining it to the user in learning mode. Use at the start of every step, before writing the step's explanation.
---

# Test a step in scratch first

In learning mode (CLAUDE.md) the user writes the code, so everything Claude explains must already be proven to work. Build the step in a scratch copy, never in the user's repo.

## Set up

Use the session's scratchpad directory (`<scratch>` below), a new folder per step:

```bash
S=<scratchpad>/step-<n>
rm -rf "$S" && mkdir -p "$S"
git -C <repo> archive HEAD | tar -x -C "$S"          # committed files only, no node_modules
cp <repo>/apps/web/.env.local "$S/apps/web/.env.local"  # only if the web app is needed
cd "$S" && git init -q && git add -A && git commit -qm base   # so `git status` shows the step's files later
pnpm install
```

A throwaway database on a spare port (never touch the user's dev or test data):

```bash
docker run -d --rm --name dbk-scratch-pg -e POSTGRES_USER=devsbucket -e POSTGRES_PASSWORD=scratch \
  -e POSTGRES_DB=devsbucket -p 127.0.0.1:5439:5432 postgres:18.6-alpine
echo 'DATABASE_URL=postgres://devsbucket:scratch@127.0.0.1:5439/devsbucket' > "$S/packages/db/.env"
```

`DATABASE_URL` set in the environment wins over `.env.local` (`process.loadEnvFile` doesn't override), so e2e runs against it with:

```bash
DATABASE_URL=postgres://devsbucket:scratch@127.0.0.1:5439/devsbucket pnpm test:e2e
```

(Port 3100 must be free: check `lsof -iTCP:3100 -sTCP:LISTEN`.) For a look in the browser, run `next dev` on another port with `NEXT_DIST_DIR=.next-scratch` and `BETTER_AUTH_URL` set to match, sign in with the e2e test user.

## Build and prove it

- Check versions with `npm view <pkg> version time --json` (pnpm refuses releases younger than a day) and current docs or `--help` for flags.
- Write the step's files, then `pnpm lint:fix` and use the **formatted** files in the explanation (Biome may rewrap them).
- Run the same checks the user will: `.claude/skills/step-verify/check.sh --e2e`, the migration SQL for schema steps, `pnpm --filter web build` for web steps.
- Try the failure case where it matters (flip a test expectation and see it fail, insert a clashing row, open a page signed out).
- Note anything surprising: it goes in the explanation and later in PROGRESS.md as a Gotcha.

## Then explain

Learning-mode format (CLAUDE.md): what and why in a few lines, the design choices with a real trade-off, then numbered steps with "📍 where to run it" above each command block and **whole files** ready to paste. Say plainly what couldn't be tested in scratch.

## Clean up

```bash
pkill -f "next dev -p <port>"   # if started
docker rm -f dbk-scratch-pg
```

Keep the scratch folder until the user's work is verified: `step-verify` compares against it.
