#!/bin/bash
# Post-merge setup for Clinica: Kingdom of Healing.
# Reconciles dependencies after a task is merged. Idempotent + non-interactive.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[post-merge] Installing frontend (Expo) dependencies from the lockfile..."
cd "$ROOT/frontend"

frontend_package_json_hash="$(sha256sum package.json | awk '{print $1}')"
frontend_package_lock_hash="$(sha256sum package-lock.json | awk '{print $1}')"

assert_frontend_metadata_unchanged() {
  if [ "$(sha256sum package.json | awk '{print $1}')" != "$frontend_package_json_hash" ] ||
     [ "$(sha256sum package-lock.json | awk '{print $1}')" != "$frontend_package_lock_hash" ]; then
    echo "[post-merge] Frontend package metadata changed during dependency setup." >&2
    exit 1
  fi
}

node ./scripts/cmd-guard.js --preinstall

npm_ci_status=0
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund || npm_ci_status=$?
assert_frontend_metadata_unchanged

if [ "$npm_ci_status" -ne 0 ]; then
  exit "$npm_ci_status"
fi

echo "[post-merge] Installing backend (FastAPI) dependencies..."
cd "$ROOT/backend"
pip install -r requirements.txt

echo "[post-merge] Checking routes (routes.ts ↔ app/ file tree)..."
node "$ROOT/frontend/scripts/check-routes.js"

echo "[post-merge] Installing git hooks..."
bash "$ROOT/scripts/install-hooks.sh"

echo "[post-merge] Done."
