#!/usr/bin/env bash
# Read-only checks for a finished step. Run from the repo root:
#   .claude/skills/step-verify/check.sh          # install, lint, typecheck, unit tests
#   .claude/skills/step-verify/check.sh --e2e    # ...and database tests + Playwright (needs Docker up)
# Prints one PASS/FAIL line per check, and the tail of the output of any that fail.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

failed=0
run() {
  local name="$1"
  shift
  local log
  log="$(mktemp)"
  if "$@" >"$log" 2>&1; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    tail -n 30 "$log" | sed 's/^/      /'
    failed=1
  fi
  rm -f "$log"
}

echo "Branch: $(git branch --show-current)"
git status --short -uall
echo

run "lockfile (pnpm install --frozen-lockfile)" pnpm install --frozen-lockfile
run "lint" pnpm lint
run "typecheck" pnpm typecheck
run "unit tests" pnpm test

if [[ "${1:-}" == "--e2e" ]]; then
  if lsof -iTCP:3100 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "FAIL  e2e: port 3100 is busy (another e2e run?)"
    failed=1
  elif ! docker compose -f docker/compose.dev.yml ps --status running --quiet postgres | grep -q .; then
    echo "FAIL  e2e: Postgres isn't running (pnpm docker:up)"
    failed=1
  else
    run "database tests" pnpm test:db
    run "e2e" pnpm test:e2e
  fi
fi

exit "$failed"
