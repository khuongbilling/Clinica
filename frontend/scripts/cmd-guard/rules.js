
const fs = require("fs");
const crypto = require("crypto");

const RULES_PATH = process.env.CMD_GUARD_RULES || "/opt/install-guard/rules.json";

const DEFAULT_LIST = {
  "yarn add **": { allowed: false, reason: "Yarn is not the frontend package manager", alternate: "npm install <package> or npx expo install <package>" },
  "yarn expo install **": { allowed: false, reason: "Yarn is not the frontend package manager", alternate: "npx expo install <package>" },
  "npm install ** expo-av* **": { allowed: false, reason: "expo-av is deprecated", alternate: "expo-audio / expo-video" },
  "npm i ** expo-av* **": { allowed: false, reason: "expo-av is deprecated", alternate: "expo-audio / expo-video" },
  "npx expo install ** expo-av* **": { allowed: false, reason: "expo-av is deprecated", alternate: "expo-audio / expo-video" },
  "npm install ** expo-barcode-scanner* **": { allowed: false, reason: "deprecated", alternate: "expo-camera" },
  "npm i ** expo-barcode-scanner* **": { allowed: false, reason: "deprecated", alternate: "expo-camera" },
  "npx expo install ** expo-barcode-scanner* **": { allowed: false, reason: "deprecated", alternate: "expo-camera" },
  "npm install ** expo-background-fetch* **": { allowed: false, reason: "deprecated", alternate: "expo-background-task" },
  "npm i ** expo-background-fetch* **": { allowed: false, reason: "deprecated", alternate: "expo-background-task" },
  "npx expo install ** expo-background-fetch* **": { allowed: false, reason: "deprecated", alternate: "expo-background-task" },
  "npm install ** expo-file-system/legacy* **": { allowed: false, reason: "deprecated", alternate: "expo-file-system" },
  "npm i ** expo-file-system/legacy* **": { allowed: false, reason: "deprecated", alternate: "expo-file-system" },
  "npx expo install ** expo-file-system/legacy* **": { allowed: false, reason: "deprecated", alternate: "expo-file-system" },
};

function isFlatList(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const values = Object.values(parsed);
  return values.length > 0 && values.every((v) => v && typeof v === "object" && typeof v.allowed === "boolean");
}

function loadRules() {
  try {
    const parsed = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
    if (isFlatList(parsed)) return { list: parsed, source: "injected" };
  } catch (e) {
    // missing or malformed -> baked default
  }
  return { list: DEFAULT_LIST, source: "baked" };
}

// CMD_GUARD_DEBUG=1 prints which ruleset is active (injected vs baked) + a content hash.
function maybeLogSource(list, source) {
  if (!process.env.CMD_GUARD_DEBUG) return;
  const sha = crypto.createHash("sha256").update(JSON.stringify(list)).digest("hex").slice(0, 8);
  console.error(`cmd-guard: rules source=${source} sha=${sha}`);
}

module.exports = { loadRules, maybeLogSource };
