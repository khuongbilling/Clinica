#!/bin/bash
# Post-merge setup for Clinica: Kingdom of Healing.
# Reconciles dependencies after a task is merged. Idempotent + non-interactive.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[post-merge] Installing frontend (Expo) dependencies..."
cd "$ROOT/frontend"
npm install --no-audit --no-fund --legacy-peer-deps

echo "[post-merge] Installing backend (FastAPI) dependencies..."
cd "$ROOT/backend"
pip install -r requirements.txt

echo "[post-merge] Done."
