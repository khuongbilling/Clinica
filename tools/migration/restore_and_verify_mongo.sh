#!/usr/bin/env bash
set -euo pipefail

# Clinica INFRA-R3B restore/parity tool.
# Restores a previously verified logical archive into an isolated target MongoDB,
# generates a metadata-only target manifest, and compares it with the source.
# It does not modify source MongoDB, frontend config, Godot config, or production endpoints.

umask 077

SOURCE_MANIFEST="${1:-}"
SOURCE_ARCHIVE="${2:-}"
TARGET_MONGO_URL="${TARGET_MONGO_URL:-}"
DB_NAME="${DB_NAME:-clinica}"
OUTPUT_DIR="${3:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[ -n "$SOURCE_MANIFEST" ] || fail "source manifest path is required"
[ -n "$SOURCE_ARCHIVE" ] || fail "source archive path is required"
[ -n "$OUTPUT_DIR" ] || fail "output directory is required"
[ -n "$TARGET_MONGO_URL" ] || fail "TARGET_MONGO_URL is required"
[ -f "$SOURCE_MANIFEST" ] || fail "source manifest not found"
[ -f "$SOURCE_ARCHIVE" ] || fail "source archive not found"
command -v mongorestore >/dev/null 2>&1 || fail "mongorestore is required"
command -v python >/dev/null 2>&1 || fail "python is required"

mkdir -p "$OUTPUT_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target_manifest="$OUTPUT_DIR/clinica-target-metadata-$stamp.json"
parity_report="$OUTPUT_DIR/clinica-parity-$stamp.json"

# Refuse to restore if the target database already contains any user collections.
TARGET_MONGO_URL="$TARGET_MONGO_URL" DB_NAME="$DB_NAME" python - <<'PY'
import os
from pymongo import MongoClient

uri = os.environ["TARGET_MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = MongoClient(uri, serverSelectionTimeoutMS=8000)
client.admin.command("ping")
existing = sorted(client[db_name].list_collection_names())
if existing:
    raise SystemExit(
        "Target database is not empty; refusing restore. Existing collections: "
        + ", ".join(existing)
    )
print("Target database preflight: empty and reachable")
PY

# Restore only into the isolated target.
mongorestore \
  --uri="$TARGET_MONGO_URL" \
  --archive="$SOURCE_ARCHIVE" \
  --gzip \
  --nsInclude="$DB_NAME.*" \
  --stopOnError

# Generate metadata-only target manifest with the same canonical schema as R3A.
TARGET_MONGO_URL="$TARGET_MONGO_URL" DB_NAME="$DB_NAME" python - "$target_manifest" <<'PY'
import hashlib
import json
import os
import platform
import sys
from datetime import datetime, timezone
from pymongo import MongoClient

out_path = sys.argv[1]
uri = os.environ["TARGET_MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = MongoClient(uri, serverSelectionTimeoutMS=8000)
client.admin.command("ping")
db = client[db_name]

build = client.admin.command("buildInfo")
try:
    fcv = client.admin.command({"getParameter": 1, "featureCompatibilityVersion": 1}).get("featureCompatibilityVersion")
except Exception:
    fcv = None

collections = []
for info in sorted(db.list_collections(), key=lambda row: row.get("name", "")):
    name = info["name"]
    entry = {
        "name": name,
        "type": info.get("type"),
        "options": info.get("options", {}),
    }
    if info.get("type") == "collection":
        entry["exact_document_count"] = db[name].count_documents({})
        indexes = []
        for idx in db[name].list_indexes():
            normalized = dict(idx)
            normalized["key"] = list(idx["key"].items())
            normalized.pop("ns", None)
            indexes.append(normalized)
        entry["indexes"] = sorted(indexes, key=lambda row: row.get("name", ""))
    elif info.get("type") == "view":
        pipeline = info.get("options", {}).get("pipeline", [])
        canonical = json.dumps(pipeline, sort_keys=True, separators=(",", ":"), default=str)
        entry["view_pipeline_sha256"] = hashlib.sha256(canonical.encode()).hexdigest()
        if "pipeline" in entry["options"]:
            entry["options"] = dict(entry["options"])
            entry["options"].pop("pipeline", None)
    collections.append(entry)

manifest = {
    "format": "clinica-mongo-metadata-v1",
    "captured_at_utc": datetime.now(timezone.utc).isoformat(),
    "database": db_name,
    "server_version": build.get("version"),
    "feature_compatibility_version": fcv,
    "python": platform.python_version(),
    "collections": collections,
    "collection_count": len(collections),
    "total_documents": sum(c.get("exact_document_count", 0) for c in collections),
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, sort_keys=True, default=str)
    f.write("\n")

print(f"Target metadata manifest written: {out_path}")
PY

python "$SCRIPT_DIR/verify_mongo_parity.py" \
  "$SOURCE_MANIFEST" \
  "$target_manifest" \
  "$parity_report"

printf '%s\n' \
  "INFRA-R3B RESTORE + PARITY COMPLETE" \
  "Target manifest: $target_manifest" \
  "Parity report:   $parity_report" \
  "Do not redirect production yet."
