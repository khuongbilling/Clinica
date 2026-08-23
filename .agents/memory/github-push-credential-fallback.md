---
name: GitHub push credential fallback
description: Safely pushing when Git transport authentication is stale despite a healthy GitHub connection.
---

Use the configured GitHub personal-access-token secret through a temporary `GIT_ASKPASS` script and `git -c credential.helper=` for a single standard push. Do not place a token in the remote URL, print it, or save it in Git configuration.

**Why:** The workspace Git transport credential can remain invalid after the GitHub connector itself has been reauthorized, blocking normal pushes even though the connector reports a healthy OAuth connection.

**How to apply:** Confirm only that the secret exists, create an ephemeral askpass helper that reads the inherited environment variable, remove it with a shell trap, then run the ordinary non-force `git push origin <branch>`. Verify the remote ref afterward.