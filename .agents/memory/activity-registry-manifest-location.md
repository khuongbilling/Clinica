---
name: Activity registry manifest location
description: Shared frontend/backend activity metadata must live in Metro-visible frontend source.
---

The canonical activity registry manifest belongs inside the frontend source tree, while the backend reads that exact JSON file from disk.

**Why:** Expo Metro refuses static imports that resolve outside the frontend project root, even when TypeScript can type-check the import. A root-level shared manifest caused a production-like web bundle failure.

**How to apply:** Keep future activity IDs, categories, homes, visibility, Daily mappings, and completion metadata in the existing frontend activity-registry manifest. Do not create a parallel backend copy; load the frontend manifest path from the backend instead.