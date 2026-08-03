/**
 * RETIRED — Combat Scaling Push 5 enemy affinity migration.
 *
 * This script was a one-time migration that inserted primaryAffinity,
 * secondaryAffinity, resistanceTags, and weaknessTags into content.ts.
 * It read `primarySystem` and `secondarySystem` from each enemy object to
 * determine the correct affinity values.
 *
 * Both `primarySystem` and `secondarySystem` were removed from the Enemy
 * type in task #388. The affinity fields have already been written to
 * content.ts, so re-running this script is no longer necessary or possible.
 *
 * If you need to update enemy affinity data in the future, edit content.ts
 * directly or write a new script that reads `corruptionAspect` / `weakElement`
 * (the current source-of-truth fields for enemy elemental identity).
 */
