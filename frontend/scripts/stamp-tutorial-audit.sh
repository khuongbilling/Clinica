#!/usr/bin/env bash
# scripts/stamp-tutorial-audit.sh
#
# Stamps the current date and git commit SHA into docs/tutorial-audit.md.
#
# Usage (from frontend/):
#   bash scripts/stamp-tutorial-audit.sh
#
# Wired into:
#   npm run gen:tutorial-audit
#   npm run validate  (via stamp step)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT_FILE="$REPO_ROOT/docs/tutorial-audit.md"

if [ ! -f "$AUDIT_FILE" ]; then
  echo "ERROR: $AUDIT_FILE not found." >&2
  exit 1
fi

TODAY="$(date +%Y-%m-%d)"
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

# Replace the "Last audited" line in-place (works on Linux with GNU sed)
sed -i "s|> \*\*Last audited:\*\* .*|> **Last audited:** ${TODAY} · commit \`${SHA}\`|" "$AUDIT_FILE"

# Replace the manual-update note line so it stays accurate
sed -i "s|> \*\*Note:\*\* .*|> **Note:** Auto-stamped by \`npm run gen:tutorial-audit\`. Re-run after each audit to keep this current.|" "$AUDIT_FILE"

echo "Stamped tutorial-audit.md → ${TODAY} · ${SHA}"
