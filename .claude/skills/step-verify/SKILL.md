---
name: step-verify
description: Verify a DevsBucket step the user built by hand (learning mode), then close it out - checks, PROGRESS.md, commit message, PR title and full PR description. Use when the user says "done", "check", "verify" after building a step, or asks for the commit/PR text. Also checks that the previous step's PR is merged on main.
---

# Verify a step and close it out

The user builds each step by hand (CLAUDE.md, learning mode). This skill is the "verify → when it passes" part. Don't change app code here: if something fails, explain the problem and the fix, and let the user apply it.

## 1. Where are we

- `git fetch -q`, then `git branch --show-current` and `git status --short -uall`.
- On `main`: the user is saying the last PR is merged. Check `git status -sb` shows `main...origin/main` with nothing ahead/behind and `git log --oneline -3 origin/main` has the merge commit ("Merge pull request #N from …/<branch>"). Report it, then move on to the next step (plan in `docs/plans/phase-N.md`).
- On a step branch: continue below. Unexpected files (`.env*`, build folders, files outside the step) → point them out.

## 2. Compare with the tested version

If this session built the step in a scratch copy (the `step-scratch` skill), compare every changed file with it; "same" for all of them is the strongest check:

```bash
cd <scratch> && for f in $(git status --short -uall | awk '{print $2}'); do diff -q "$f" "<repo>/$f" >/dev/null && echo "same  $f" || echo "DIFF  $f"; done
```

For any `DIFF`, show the diff and judge it: formatting or a harmless choice is fine, say so; anything else is a finding.

## 3. Run the checks

From the repo root:

```bash
.claude/skills/step-verify/check.sh          # lockfile, lint, typecheck, unit tests
.claude/skills/step-verify/check.sh --e2e    # add this when apps/web, packages/db or e2e changed
```

Plus the step's own checks from the step table (for example: migration applied to both databases, a page in the browser).

## 4. Report

Short, plain: what was compared, each check PASS/FAIL, and anything the checks can't prove (say plainly what wasn't tested). If anything failed: the problem, the fix, and stop here.

## 5. When it passes

1. **`docs/PROGRESS.md`:** tick the step and add `- Note:` lines (what was built, file names, decisions, follow-ups for later steps) and `- Gotcha:` lines for surprises. Keep notes in the existing style.
2. **`CLAUDE.md` / decisions:** update them if the step changed a convention, command or locked decision (memory: keep docs current).
3. Run `pnpm lint` again if you touched anything besides Markdown.
4. Give the user, ready to paste:
   - 📍 repo root, the commit and push commands (each in its own `bash` block):
     `git add -A && git commit -m "<type>(<scope>): <summary>"` and `git push -u origin <branch>`
   - **PR title** (conventional commit, short).
   - **PR description** in one fenced `markdown` block, using this shape:

```markdown
## What

<one paragraph: which phase/step, what it adds and why>

## Changes

- <file or area>: <what changed>
- `docs/PROGRESS.md`: step N ticked

## How to test

    <commands, and what to click or look for>

## Checklist

- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes (<counts>)
- [x] `pnpm test:e2e` passes (or: not affected)
- [x] No `.env` files committed
- [x] `docs/PROGRESS.md` updated
```

   - Reminder: merge with **Create a merge commit**, then `git switch main && git pull`. Branches are kept.
5. One line on what the next step is.

Don't commit, push or open the PR yourself unless the user says "you do it".
