---
name: pythonlibs package recovery
description: What to do when Start Backend (uvicorn/FastAPI) fails with ModuleNotFoundError even though the workflow ran fine before and requirements.txt is unchanged.
---

Symptom: backend workflow (not using `--reload`) suddenly fails with `ModuleNotFoundError` for a package (uvicorn, fastapi, pymongo, motor, etc.) that was previously working, with no code change to imports. `.pythonlibs/lib/python3.11/site-packages/<pkg>/` is missing but a stray `<pkg>-<version>.dist-info/` may remain — the actual package payload got wiped from `.pythonlibs` while dist-info metadata survived.

**Why:** This project uses a plain `requirements.txt` (no `pyproject.toml`/uv project at the repo root). Running `installLanguagePackages({language: "python", ...})` in this state makes the underlying `uv` tool auto-create a brand-new `pyproject.toml`/uv project at the workspace root and can leave `.pythonlibs` in a broken/partial state — uv also refuses to write into the Nix-store python (`Permission denied`) if it picks the wrong target.

**How to apply:** If this happens: (1) delete any freshly-created root `pyproject.toml`/`uv.lock` that doesn't match the project's real dependency file, (2) reinstall directly with `<pythonlibs>/bin/python3 -m pip install --target <pythonlibs>/lib/python3.11/site-packages -r backend/requirements.txt` (or list the missing packages explicitly) rather than the package-management tool, (3) verify with a plain `python3 -c "import <pkg>"` before restarting the workflow. Warnings about "Target directory already exists" during this pip install are harmless.
