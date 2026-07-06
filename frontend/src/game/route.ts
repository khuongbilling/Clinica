// Where a returning player should land once assets are warmed. Kept in one place
// so the boot gate and the preloader resolve the destination identically.
type EntryPlayer =
  | {
      prologue_complete?: boolean;
      identity_restored?: boolean;
      diagnostic_intro_seen?: boolean;
      seen_reminiscence?: boolean;
    }
  | null
  | undefined;

export function resolveEntryRoute(player: EntryPlayer): string {
  if (!player) return "/prologue";
  if (player.prologue_complete === false) return "/prologue";
  if (player.identity_restored === false || player.diagnostic_intro_seen === false) {
    return "/post-recall";
  }
  // Resume the memory-reminiscence scene if it was interrupted before the hub.
  if (player.seen_reminiscence === false) return "/reminiscence";
  return "/(tabs)";
}
