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
// /story-scene?sceneId=<id>. No progression state is written by viewing.

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
};

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
  },
];

export function getStoryScene(id: string | undefined): StoryScene | undefined {
  return STORY_SCENES.find((s) => s.id === id);
}
