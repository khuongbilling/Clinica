#!/bin/bash
# Installs local git hooks for Clinica: Kingdom of Healing.
# Safe to run multiple times (idempotent).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT/.git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "[install-hooks] .git/hooks directory not found — skipping (not a git repo?)."
  exit 0
fi

# ── pre-push: run check-routes before every push ─────────────────────────────
HOOK="$HOOKS_DIR/pre-push"

cat > "$HOOK" << 'EOF'
#!/bin/bash
# pre-push hook — installed by scripts/install-hooks.sh
# Runs check-routes to catch stale route constants before code leaves the machine.

ROOT="$(git rev-parse --show-toplevel)"

echo "[pre-push] Checking routes (routes.ts ↔ app/ file tree)..."
node "$ROOT/frontend/scripts/check-routes.js"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "[pre-push] Push blocked: fix the route error(s) above before pushing."
fi

exit $EXIT_CODE
EOF

chmod +x "$HOOK"
echo "[install-hooks] pre-push hook installed at $HOOK"
