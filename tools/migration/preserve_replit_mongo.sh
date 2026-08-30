#!/usr/bin/env bash
set -euo pipefail

# Clinica INFRA-R3A source-preservation tool.
# Creates a metadata-only source manifest plus a compressed logical mongodump.
# It never modifies MongoDB documents, application config, or the live dbpath.

umask 077

DB_NAME="${DB_NAME:-clinica}"
MONGO_URL="${MONGO_URL:-mongodb://127.0.0.1:27017}"
OUTPUT_DIR="${1:-}"
LIVE_DBPATH="${CLINICA_LIVE_DBPATH:-.local/mongodb-data}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[ -n "$OUTPUT_DIR" ] || fail "Usage: $0 <backup-output-directory>"
command -v python >/dev/null 2>&1 || fail "python is required"
command -v mongodump >/dev/null 2>&1 || fail "mongodump is required; do not substitute a raw WiredTiger copy"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

live_abs="$(python - "$LIVE_DBPATH" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"
out_abs="$(python - "$OUTPUT_DIR" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
)"

case "$out_abs" in
  "$live_abs"|"$live_abs"/*) fail "Backup output must not be inside the live MongoDB dbpath" ;;
esac

mkdir -p "$OUTPUT_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
manifest="$OUTPUT_DIR/clinica-source-metadata-$stamp.json"
archive="$OUTPUT_DIR/clinica-source-$stamp.archive.gz"
checksum="$archive.sha256"

# Metadata only: collection names/counts/options and index definitions.
# No document bodies, player IDs, names, emails, tokens, or secret values are written.
MONGO_URL="$MONGO_URL" DB_NAME="$DB_NAME" python - "$manifest" <<'PY'
import hashlib
import json
import os
import platform
import sys
from datetime import datetime, timezone
from pymongo import MongoClient

out_path = sys.argv[1]
uri = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = MongoClient(uri, serverSelectionTimeoutMS=5000)
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

print(f"Metadata manifest written: {out_path}")
print(f"Collections: {manifest['collection_count']}; total documents: {manifest['total_documents']}")
PY

# Logical, portable backup. This reads the source database and writes only to OUTPUT_DIR.
mongodump \
  --uri="$MONGO_URL" \
  --db="$DB_NAME" \
  --archive="$archive" \
  --gzip

sha256sum "$archive" > "$checksum"
sha256sum --check "$checksum"

printf '%s\n' \
  "INFRA-R3A SOURCE PRESERVATION COMPLETE" \
  "Manifest: $manifest" \
  "Archive:  $archive" \
  "Checksum: $checksum" \
  "Do not delete/cancel Replit or redirect production yet."