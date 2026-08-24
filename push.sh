#!/bin/sh
set -eu

cat >&2 <<'MESSAGE'
This helper is intentionally disabled: it never reads credentials and never
constructs a credential-bearing Git URL.

Use Replit Version Control for normal repository operations, or use your
standard authenticated Git workflow directly against the repository's
configured origin, for example:

  git push origin main

No push was performed by this helper.
MESSAGE

exit 1
