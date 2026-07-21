#!/usr/bin/env bash
# check-em-dashes.sh
# Fails if any player-visible string in the game content files contains an em dash (—).
#
# WHY: Em dashes render inconsistently across mobile font stacks and were swept
# out of all player-facing copy. Use a semicolon, colon, or period instead.
# Em dashes in code comments (// or /* ... */) are fine and are NOT flagged.
#
# USAGE:
#   bash scripts/check-em-dashes.sh          # exits 0 (clean) or 1 (violations found)
#
# Run this before committing new story/hero/enemy content.

FILES=(
  "frontend/src/game/content.ts"
  "frontend/src/game/onboarding.ts"
  "frontend/src/game/storyScenes.ts"
  "frontend/src/game/missions.ts"
  "frontend/src/game/lessons.ts"
  "frontend/src/game/cues.ts"
  "frontend/src/game/systemNarrator.ts"
  "frontend/src/game/equipment.ts"
  "frontend/src/game/units.ts"
)

found=0
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "WARN: $f not found, skipping"
    continue
  fi

  # Use awk to detect em dashes outside of comments.
  # Tracks block-comment state across lines and strips inline // comments.
  matches=$(awk '
    BEGIN { in_block = 0; EM = "\xe2\x80\x94" }
    {
      line = $0

      # Check if we are still inside a block comment
      if (in_block) {
        if (index(line, "*/") > 0) {
          in_block = 0
          # Remainder after */ could have code — check it
          rest = substr(line, index(line, "*/") + 2)
          # Strip any trailing inline comment from the remainder
          idx = index(rest, "//")
          if (idx > 0) rest = substr(rest, 1, idx - 1)
          if (index(rest, EM) > 0) print NR": "line
        }
        # Entire line is inside block comment — skip
        next
      }

      # Not in a block comment: check for comment openers on this line
      trimmed = line
      sub(/^[[:space:]]+/, "", trimmed)

      # Skip pure single-line comment lines (// ...)
      if (trimmed ~ /^\/\//) next

      # Skip lines that are entirely a block comment on one line  /* ... */
      if (trimmed ~ /^\/\*.*\*\/[[:space:]]*$/) next

      # Line starts a block comment /* ... (without closing on the same line)
      if (trimmed ~ /^\/\*/ && index(line, "*/") == 0) {
        in_block = 1
        next
      }

      # Strip an inline // comment (heuristic: first // on the line)
      code = line
      idx = index(code, "//")
      if (idx > 0) code = substr(code, 1, idx - 1)

      # Strip an inline /* ... */ block on the same line
      while (match(code, /\/\*[^*]*\*+([^/*][^*]*\*+)*\//)) {
        code = substr(code, 1, RSTART - 1) substr(code, RSTART + RLENGTH)
      }

      # If a /* opens but never closes, everything from it onward is a comment
      if (index(code, "/*") > 0 && index(code, "*/") == 0) {
        code = substr(code, 1, index(code, "/*") - 1)
        in_block = 1
      }

      # Flag if em dash remains in the code portion
      if (index(code, EM) > 0) {
        print NR": "line
      }
    }
  ' "$f" || true)

  if [ -n "$matches" ]; then
    echo "EM DASH found in $f:"
    echo "$matches"
    echo ""
    found=1
  fi
done

if [ "$found" -eq 1 ]; then
  echo "-------------------------------------------------------"
  echo "FAIL: Em dash (—) found in player-visible string(s)."
  echo "Replace with a semicolon, colon, or period. See above."
  echo "-------------------------------------------------------"
  exit 1
else
  echo "OK: No em dashes found in player-visible strings."
  exit 0
fi
