#!/usr/bin/env python3
"""Compare Clinica MongoDB metadata manifests without exposing document contents.

The verifier intentionally ignores host/runtime metadata and non-semantic index
implementation fields while requiring collection/view sets, document counts,
collection options, view pipeline hashes, and index semantics to match.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

IGNORED_INDEX_FIELDS = {"v", "ns", "background", "buildUUID"}


def _canonical(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _canonical(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [_canonical(item) for item in value]
    return value


def _normalize_index(index: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        key: value
        for key, value in index.items()
        if key not in IGNORED_INDEX_FIELDS
    }
    key_spec = normalized.get("key")
    if isinstance(key_spec, dict):
        normalized["key"] = list(key_spec.items())
    return _canonical(normalized)


def _collection_map(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for raw in manifest.get("collections", []):
        name = raw.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError("manifest contains a collection without a valid name")
        if name in result:
            raise ValueError(f"manifest contains duplicate collection entry: {name}")
        result[name] = raw
    return result


def compare(source: dict[str, Any], target: dict[str, Any]) -> dict[str, Any]:
    mismatches: list[dict[str, Any]] = []

    source_db = source.get("database")
    target_db = target.get("database")
    if source_db != target_db:
        mismatches.append(
            {
                "scope": "database",
                "field": "name",
                "source": source_db,
                "target": target_db,
            }
        )

    source_collections = _collection_map(source)
    target_collections = _collection_map(target)

    source_names = set(source_collections)
    target_names = set(target_collections)
    if source_names != target_names:
        mismatches.append(
            {
                "scope": "database",
                "field": "collection_set",
                "missing_on_target": sorted(source_names - target_names),
                "unexpected_on_target": sorted(target_names - source_names),
            }
        )

    for name in sorted(source_names & target_names):
        src = source_collections[name]
        dst = target_collections[name]

        if src.get("type") != dst.get("type"):
            mismatches.append(
                {
                    "scope": name,
                    "field": "type",
                    "source": src.get("type"),
                    "target": dst.get("type"),
                }
            )

        if _canonical(src.get("options", {})) != _canonical(dst.get("options", {})):
            mismatches.append(
                {
                    "scope": name,
                    "field": "options",
                    "source": _canonical(src.get("options", {})),
                    "target": _canonical(dst.get("options", {})),
                }
            )

        if src.get("type") == "collection":
            if src.get("exact_document_count") != dst.get("exact_document_count"):
                mismatches.append(
                    {
                        "scope": name,
                        "field": "exact_document_count",
                        "source": src.get("exact_document_count"),
                        "target": dst.get("exact_document_count"),
                    }
                )

            src_indexes = {
                idx.get("name"): _normalize_index(idx)
                for idx in src.get("indexes", [])
            }
            dst_indexes = {
                idx.get("name"): _normalize_index(idx)
                for idx in dst.get("indexes", [])
            }
            if src_indexes != dst_indexes:
                mismatches.append(
                    {
                        "scope": name,
                        "field": "indexes",
                        "source": src_indexes,
                        "target": dst_indexes,
                    }
                )

        if src.get("type") == "view":
            if src.get("view_pipeline_sha256") != dst.get("view_pipeline_sha256"):
                mismatches.append(
                    {
                        "scope": name,
                        "field": "view_pipeline_sha256",
                        "source": src.get("view_pipeline_sha256"),
                        "target": dst.get("view_pipeline_sha256"),
                    }
                )

    source_total = source.get("total_documents")
    target_total = target.get("total_documents")
    if source_total != target_total:
        mismatches.append(
            {
                "scope": "database",
                "field": "total_documents",
                "source": source_total,
                "target": target_total,
            }
        )

    return {
        "format": "clinica-mongo-parity-v1",
        "source_database": source_db,
        "target_database": target_db,
        "source_collection_count": len(source_collections),
        "target_collection_count": len(target_collections),
        "source_total_documents": source_total,
        "target_total_documents": target_total,
        "status": "PASS" if not mismatches else "FAIL",
        "mismatches": mismatches,
    }


def main() -> int:
    if len(sys.argv) != 4:
        print(
            "Usage: verify_mongo_parity.py <source-manifest.json> "
            "<target-manifest.json> <report.json>",
            file=sys.stderr,
        )
        return 64

    source_path = Path(sys.argv[1])
    target_path = Path(sys.argv[2])
    report_path = Path(sys.argv[3])

    source = json.loads(source_path.read_text(encoding="utf-8"))
    target = json.loads(target_path.read_text(encoding="utf-8"))
    report = compare(source, target)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(
        f"MongoDB parity: {report['status']} | "
        f"collections {report['source_collection_count']}/"
        f"{report['target_collection_count']} | "
        f"documents {report['source_total_documents']}/"
        f"{report['target_total_documents']}"
    )
    if report["status"] != "PASS":
        print(f"Parity report: {report_path}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
