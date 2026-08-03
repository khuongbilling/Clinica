/**
 * check-prologue-vn-cfg.js
 *
 * Validates that every key in PROLOGUE_CHARACTERS also has an entry in VN_ART_CFG.
 *
 * TypeScript's Record<PrologueSpeakerId, …> type already enforces this at
 * compile time, but this script lets the validate pipeline catch the error
 * with a clear, actionable message before tsc runs — and it doubles as
 * documentation that the two maps must stay in sync.
 *
 * Run:  node scripts/check-prologue-vn-cfg.js
 */

const fs   = require("fs");
const path = require("path");

const CHARS_FILE  = path.join(__dirname, "../src/game/prologueCharacters.ts");
const VN_BAR_FILE = path.join(__dirname, "../src/components/prologue/PrologueVNBar.tsx");

/**
 * Extract the top-level (depth-1) keys of an object literal assigned to `varName`.
 * Handles type-annotated declarations like:
 *   const FOO: Record<K, V> = {  KEY: … }
 * by searching for `= {` after the variable name, not just the first `{`.
 */
function extractTopLevelObjectKeys(src, varName) {
  // Find the variable declaration
  const declRe = new RegExp(`(?:export\\s+)?const\\s+${varName}\\b`);
  const declIdx = src.search(declRe);
  if (declIdx === -1) throw new Error(`Could not locate '${varName}' in file.`);

  // After the declaration, find the `= {` that opens the object literal.
  // This correctly skips over any type annotation that may contain `{…}`.
  const assignRe = /=\s*\{/g;
  assignRe.lastIndex = declIdx;
  const assignMatch = assignRe.exec(src);
  if (!assignMatch) throw new Error(`Could not find '= {' for '${varName}'.`);

  // `objStart` points to the `{` that opens the object literal.
  const objStart = src.indexOf("{", assignMatch.index);

  const keys  = [];
  let depth   = 0;

  for (let i = objStart; i < src.length; i++) {
    if (src[i] === "{") {
      depth++;
    } else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }

    // We're at depth 1 (one brace in) — collect top-level keys.
    // Keys are UPPER_SNAKE identifiers immediately followed by `:`.
    if (depth === 1) {
      const slice    = src.slice(i);
      const keyMatch = slice.match(/^([A-Z_][A-Z0-9_]*)\s*:/);
      if (keyMatch) {
        keys.push(keyMatch[1]);
        i += keyMatch[1].length - 1; // advance past the key text
      }
    }
  }

  return keys;
}

let failed = false;

try {
  const charsSrc = fs.readFileSync(CHARS_FILE,  "utf8");
  const vnBarSrc = fs.readFileSync(VN_BAR_FILE, "utf8");

  const charKeys = extractTopLevelObjectKeys(charsSrc,  "PROLOGUE_CHARACTERS");
  const cfgKeys  = extractTopLevelObjectKeys(vnBarSrc,  "VN_ART_CFG");

  if (charKeys.length === 0) {
    console.error("[check:prologue-vn-cfg] ERROR: Could not parse any keys from PROLOGUE_CHARACTERS.");
    process.exit(1);
  }

  const cfgSet  = new Set(cfgKeys);
  const missing = charKeys.filter(k => !cfgSet.has(k));

  if (missing.length > 0) {
    console.error(
      `[check:prologue-vn-cfg] FAIL — ${missing.length} character(s) in PROLOGUE_CHARACTERS ` +
      `have no entry in VN_ART_CFG:\n` +
      missing.map(k => `  • ${k}  → add to VN_ART_CFG in PrologueVNBar.tsx`).join("\n")
    );
    failed = true;
  } else {
    console.log(
      `[check:prologue-vn-cfg] OK — all ${charKeys.length} prologue character(s) have a VN_ART_CFG entry ` +
      `(${charKeys.join(", ")})`
    );
  }
} catch (err) {
  console.error("[check:prologue-vn-cfg] ERROR:", err.message);
  failed = true;
}

if (failed) process.exit(1);
