// Story Scenes — the mature-manhwa narrative layer (hybrid art direction).
//
// Gameplay screens stay luminous donghua; narrative beats (chapter openings,
// Lotus Keeper scenes, past-life flashbacks) render in the muted manhwa ink
// style through the shared /story-scene screen. Each scene is a single still
// illustration plus paced text — same philosophy as the reminiscence motion
// comic, but reusable for future chapters without a bespoke screen per beat.
//
// Adding a scene = add an entry here (art under frontend/assets/story/) and
// it is automatically listed in the Story Gallery and routable via
// /story-scene?sceneId=<id>. Viewing a scene writes only its "seen" flag
// (player.story_scenes_seen) — never progression or rewards.
//
// Scenes carry cinematic metadata (motion effect + ambient FX, matching the
// Reminiscence motion-comic vocabulary) and an unlock rule:
// - chapter scenes auto-play once when chapter_progress reaches their chapter
// - side scenes unlock at existing progression beats and surface via a
//   one-time "new memory" prompt on the hub (never auto-play).

import type { PlayerState } from "./types";
import type { AmbienceMood } from "./ambient";
import type { PanelEffect } from "@/src/components/reminiscence/MotionPanel";

export type StorySceneUnlock =
  | { type: "chapter"; chapter: number }
  | { type: "beat"; beat: "class_confirmed" | "first_lesson" | "seasoned_healer"; hint: string };

export type StoryScene = {
  id: string;
  /** Small uppercase label above the title (e.g. "CHAPTER I"). */
  kicker: string;
  title: string;
  /** First-person or narrator lines, paced one paragraph per tap. */
  lines: string[];
  /** Optional Lotus Keeper dialogue, styled distinctly (gold, italic). */
  keeperLines?: string[];
  art: number;
  /** Ken-burns style motion applied to the still illustration. */
  effect: PanelEffect;
  /** Ambient overlays — rising light motes / falling lotus petals / rain. */
  motes?: boolean;
  moteColor?: string;
  petals?: boolean;
  rain?: boolean;
  /** Ambient sound mood while the scene is open (see ambient.ts). */
  ambience?: AmbienceMood;
  unlock: StorySceneUnlock;
};

/**
 * The ambience mood for a scene — its explicit `ambience`, or one derived
 * from its visual FX (rain → rain patter, petals → warm chimes, otherwise
 * the quiet ward hum) so new scenes get fitting sound for free.
 */
export function sceneAmbience(scene: StoryScene): AmbienceMood {
  if (scene.ambience) return scene.ambience;
  if (scene.rain) return "rain";
  if (scene.petals) return "chimes";
  return "ward";
}

export const STORY_SCENES: StoryScene[] = [
  {
    id: "chapter_01",
    kicker: "CHAPTER I",
    title: "The Empty Ward",
    lines: [
      "The ward was quiet the morning I returned — not the quiet of peace, but the quiet of waiting.",
      "Every empty bed held a question I had once answered too quickly.",
      "This time, I would earn my answers before I gave them.",
    ],
    art: require("../../assets/story/chapter_01_opening.png"),
    effect: "zoomIn",
    motes: true,
    moteColor: "#D8E4EE",
    unlock: { type: "chapter", chapter: 1 },
  },
  {
    id: "chapter_02",
    kicker: "CHAPTER II",
    title: "The Gathering Miasma",
    lines: [
      "It began at the edges of the kingdom — a shadow in the air that lanterns could not burn away.",
      "The healers watched the sky. The people watched the healers.",
      "And I understood, at last, that knowledge is not for the one who holds it. It is for everyone standing beneath the same storm.",
    ],
    art: require("../../assets/story/chapter_02_opening.png"),
    effect: "panSlow",
    rain: true,
    unlock: { type: "chapter", chapter: 2 },
  },
  {
    id: "keeper_audience",
    kicker: "THE LOTUS KEEPER",
    title: "An Audience in the Dark",
    lines: [
      "Between one breath and the next, the world fell away — and the Keeper was there, seated where no floor should be.",
    ],
    keeperLines: [
      "You return to me changed. Not stronger — clearer. That is the rarer thing.",
      "Power is what the desperate reach for. Understanding is what the worthy build.",
      "Go back to your ward, healer. The lotus does not bloom for those who watch it. It blooms for those who tend the water.",
    ],
    art: require("../../assets/story/keeper_scene.png"),
    effect: "lotusRecall",
    petals: true,
    motes: true,
    moteColor: "#FBE7B0",
    unlock: { type: "beat", beat: "class_confirmed", hint: "Confirm your class calling" },
  },
  {
    id: "physician_past",
    kicker: "FRAGMENTS OF BEFORE",
    title: "The Doctor Who Stayed",
    lines: [
      "In my first life there was a physician I never thanked — an old doctor who stayed long after the night shift ended.",
      "Cold coffee. Tired eyes. And still, when the frightened family asked their hundredth question, he answered as if it were the first.",
      "I did not understand then what I was seeing. It was not knowledge. It was devotion wearing knowledge like a coat.",
    ],
    art: require("../../assets/story/physician_past.png"),
    effect: "panSlow",
    motes: true,
    moteColor: "#FBE7B0",
    unlock: { type: "beat", beat: "first_lesson", hint: "Complete your first University lesson" },
  },
  {
    id: "flashback_shards",
    kicker: "MEMORY",
    title: "What the Lotus Kept",
    lines: [
      "Some nights, the recall returns to me in shards — a classroom, a corridor, a hand held in the dark.",
      "The Lotus did not save all of me. It saved what mattered.",
      "The rest, I am learning to rebuild — one patient, one lesson, one day at a time.",
    ],
    art: require("../../assets/story/flashback_shards.png"),
    effect: "heartbeat",
    petals: true,
    unlock: { type: "beat", beat: "seasoned_healer", hint: "Complete five Ward Shifts" },
  },
  // ── Chapter 9 — The Real Ward Opening ───────────────────────────────────
  // C6: First real-world ward encounter transition scene.
  // Art stand-in: chapter_01_opening.png (ward corridor, thematically fitting).
  // Replace with a dedicated Chapter 9 art asset when available.
  {
    id: "chapter_09",
    kicker: "CHAPTER IX · REAL WARD",
    title: "The Ward That Does Not Reset",
    lines: [
      "The simulation doors opened.",
      "For the first time, the ward did not reset.",
      "The signs were still there — the same vital threads I had learned to read.",
      "But now, hesitation had consequences.",
      "And the ward did not wait.",
    ],
    art: require("../../assets/story/chapter_01_opening.png"),
    effect: "panSlow",
    rain: true,
    ambience: "ward",
    unlock: { type: "chapter", chapter: 9 },
  },
];

export function getStoryScene(id: string | undefined): StoryScene | undefined {
  return STORY_SCENES.find((s) => s.id === id);
}

export function isSceneSeen(player: PlayerState | null | undefined, sceneId: string): boolean {
  return !!player?.story_scenes_seen?.includes(sceneId);
}

/** Whether the scene's narrative beat has been reached for this player. */
export function isSceneUnlocked(scene: StoryScene, player: PlayerState | null | undefined): boolean {
  if (!player) return false;
  const u = scene.unlock;
  if (u.type === "chapter") return (player.chapter_progress ?? 1) >= u.chapter;
  switch (u.beat) {
    case "class_confirmed":
      return !!player.class_tree_id && !!player.class_diagnostic_resonance;
    case "first_lesson":
      return (player.lessons_completed || []).length >= 1;
    case "seasoned_healer":
      return (player.runs_completed || 0) >= 5;
  }
}

/**
 * The chapter scene (if any) that should auto-play right now: its chapter
 * milestone is reached and the player has never watched it. Chapter scenes
 * auto-play in order, one per hub visit.
 */
export function nextAutoStoryScene(player: PlayerState | null | undefined): StoryScene | undefined {
  if (!player) return undefined;
  return STORY_SCENES.find(
    (s) => s.unlock.type === "chapter" && isSceneUnlocked(s, player) && !isSceneSeen(player, s.id),
  );
}

/**
 * A newly unlocked side scene the player hasn't watched — surfaced as a
 * gentle "new memory" prompt on the hub rather than auto-playing.
 */
export function nextUnseenSideScene(player: PlayerState | null | undefined): StoryScene | undefined {
  if (!player) return undefined;
  return STORY_SCENES.find(
    (s) => s.unlock.type === "beat" && isSceneUnlocked(s, player) && !isSceneSeen(player, s.id),
  );
}
