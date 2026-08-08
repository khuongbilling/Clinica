/**
 * dialogueSkip.ts — Push H: safe dialogue-skip gating.
 *
 * PURPOSE:
 *   Alternate Day / Evening / Night routes unlock different scenes for the
 *   same chapter.  Without per-dialogue tracking, a player who completed the
 *   Day route and then opens the Evening route would be offered "Skip" even
 *   though they have never seen the Evening dialogue.
 *
 * RULE:
 *   "Skip Seen Scene" is offered only when EVERY dialogue ID in the scene
 *   has been seen.  A scene with no declared dialogueIds is never skippable —
 *   the absent list means authoring is incomplete, not that everything is seen.
 *
 * USAGE:
 *   const canSkip = canSkipDialogueScene(
 *     scene.dialogueIds ?? [scene.id],   // default: single scene-level ID
 *     new Set(player.story_scenes_seen),
 *   );
 */

/**
 * Returns true when every dialogue ID in the scene has been seen.
 *
 * @param sceneDialogueIds  IDs of all dialogue beats this scene covers.
 *                          For a single-route scene, this is typically [scene.id].
 *                          For an alternate-route scene, it lists every route
 *                          variant — ALL must be seen before skip is offered.
 * @param seenDialogueIds   Set of IDs the player has already seen
 *                          (built from player.story_scenes_seen).
 */
export function canSkipDialogueScene(
  sceneDialogueIds: string[],
  seenDialogueIds: Set<string>,
): boolean {
  // Empty list → authoring incomplete or scene has no dialogue IDs declared.
  // Never offer skip — the player cannot have seen something with no IDs.
  if (sceneDialogueIds.length === 0) return false;

  return sceneDialogueIds.every((id) => seenDialogueIds.has(id));
}
