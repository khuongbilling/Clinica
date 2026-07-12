import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  STORY_SCENES, getStoryScene, isSceneSeen, isSceneUnlocked, sceneAmbience,
} from "@/src/game/storyScenes";
import { pokeAmbience, startAmbience, stopAmbience } from "@/src/game/ambient";
import { useSettings } from "@/src/game/settingsStore";
import { usePlayer } from "@/src/game/store";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { MotionPanel } from "@/src/components/reminiscence/MotionPanel";
import { LotusPetalOverlay } from "@/src/components/reminiscence/LotusPetalOverlay";
import { LotusRecallBurst } from "@/src/components/reminiscence/LotusRecallBurst";
import { LightMotesOverlay } from "@/src/components/reminiscence/LightMotesOverlay";
import { RainOverlay } from "@/src/components/reminiscence/RainOverlay";
import { NarrativePanel } from "@/src/components/ui/NarrativePanel";
import { SPACING, RADIUS } from "@/src/theme/colors";

// Story Scene — the reusable mature-manhwa narrative screen (hybrid art
// direction). Renders one manhwa illustration full-bleed with the same
// motion-comic treatment as the Reminiscence (ken-burns zoom/pan, ambient
// petals/motes/rain, staged text fade-ins) and paced tap-to-advance lines in
// an ink-toned NarrativePanel. Without a sceneId it shows the Story Gallery
// list (locked / NEW / seen states). Finishing or skipping a scene records
// only its "seen" flag — never progression or rewards.
const INK = {
  paper: "#EDE6D8",
  gold: "#E0B45C",
  steel: "#9FB4C7",
  black: "#07080D",
} as const;

export default function StorySceneScreen() {
  const { sceneId } = useLocalSearchParams<{ sceneId?: string }>();
  const scene = getStoryScene(sceneId);

  if (!scene) return <StoryGallery />;
  return <SceneViewer key={scene.id} sceneId={scene.id} />;
}

function SceneViewer({ sceneId }: { sceneId: string }) {
  const router = useRouter();
  const { player, markStorySceneSeen } = usePlayer();
  const { soundEnabled } = useSettings();
  // During onboarding (prologue not yet complete) a story scene is part of a
  // scripted flow — back navigation would skip or re-enter scripted beats, so
  // it is blocked. leave() calls allowNextBack() so its own router.back() exit
  // still works. After the prologue, scenes are replayable from the gallery
  // and back behaves normally.
  const { allowNextBack } = useBlockBack({ active: !player?.prologue_complete });
  const scene = getStoryScene(sceneId)!;
  const allLines = [
    ...scene.lines.map((t) => ({ t, keeper: false })),
    ...(scene.keeperLines ?? []).map((t) => ({ t, keeper: true })),
  ];
  const [shown, setShown] = useState(1);
  const fade = useRef(new Animated.Value(0)).current;
  // Smooth ink ↔ luminous transition: the whole scene fades in from black on
  // mount, and fades back to black before leaving (instead of a hard cut).
  const veil = useRef(new Animated.Value(1)).current;
  const leavingRef = useRef(false);

  useEffect(() => {
    Animated.timing(veil, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  }, [veil]);

  // Gentle ambient loop matching the scene's mood while it is open —
  // starts/stops with the live mute toggle and always stops on exit.
  useEffect(() => {
    if (soundEnabled) startAmbience(sceneAmbience(scene));
    else stopAmbience();
    return () => stopAmbience();
  }, [soundEnabled, scene]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [shown, fade]);

  const done = shown >= allLines.length;

  function leave() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    // Mark seen on any exit (finish, skip, or close) so one-time triggers and
    // NEW badges never re-fire; then fade to ink black before navigating.
    markStorySceneSeen(scene.id);
    Animated.timing(veil, { toValue: 1, duration: 450, useNativeDriver: true }).start(() => {
      // This exit is deliberate — let the single back-pop through the guard.
      allowNextBack();
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    });
  }

  function advance() {
    // Taps count as user gestures — wake a suspended AudioContext so the
    // ambience can start even under strict browser autoplay policies.
    pokeAmbience();
    if (!done) setShown((n) => n + 1);
    else leave();
  }

  return (
    <View style={styles.root} testID="story-scene">
      <MotionPanel key={scene.id} source={scene.art} effect={scene.effect}>
        {scene.effect === "lotusRecall" && <LotusRecallBurst />}
        {scene.rain && <RainOverlay density={1} />}
        {scene.motes && <LightMotesOverlay density={1} color={scene.moteColor} />}
        {scene.petals && <LotusPetalOverlay density={scene.effect === "lotusRecall" ? 1.4 : 1} />}
        <LinearGradient
          colors={["rgba(4,5,9,0.55)", "rgba(4,5,9,0)", "rgba(4,5,9,0.35)", "rgba(4,5,9,0.9)"]}
          locations={[0, 0.28, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </MotionPanel>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>{scene.kicker}</Text>
            <Text style={styles.title}>{scene.title}</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable onPress={leave} hitSlop={10} testID="story-scene-skip">
              <Text style={styles.skipTxt}>Skip</Text>
            </Pressable>
            <Pressable onPress={leave} hitSlop={12} testID="story-scene-close">
              <Ionicons name="close" size={22} color={INK.paper} />
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.tapZone} onPress={advance} testID="story-scene-advance">
          <NarrativePanel tone="ink" style={styles.panel}>
            {allLines.slice(0, shown).map((ln, i) => (
              <Animated.Text
                key={i}
                style={[
                  ln.keeper ? styles.keeperLine : styles.line,
                  i === shown - 1 && { opacity: fade },
                ]}
              >
                {ln.t}
              </Animated.Text>
            ))}
            <Text style={styles.hint}>{done ? "Tap to close" : "Tap to continue"}</Text>
          </NarrativePanel>
        </Pressable>
      </SafeAreaView>
      {/* Fade veil — sits above everything for the ink ↔ luminous transition */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: INK.black, opacity: veil }]}
      />
    </View>
  );
}

function StoryGallery() {
  const router = useRouter();
  const { player } = usePlayer();
  return (
    <SafeAreaView style={styles.galleryRoot} edges={["top", "bottom"]} testID="story-gallery">
      <View style={styles.galleryHeader}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="story-gallery-back">
          <Ionicons name="chevron-back" size={22} color={INK.paper} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>FRAGMENTS & CHAPTERS</Text>
          <Text style={styles.title}>Story Scenes</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.galleryList}>
        {STORY_SCENES.map((s) => {
          const unlocked = isSceneUnlocked(s, player);
          const seen = isSceneSeen(player, s.id);
          if (!unlocked) {
            return (
              <View key={s.id} style={[styles.card, styles.cardLocked]} testID={`story-card-locked-${s.id}`}>
                <ExpoImage source={s.art} style={[styles.cardArt, styles.cardArtLocked]} contentFit="cover" transition={250} blurRadius={6} />
                <LinearGradient
                  colors={["rgba(4,5,9,0.45)", "rgba(4,5,9,0.75)", "rgba(4,5,9,0.95)"]}
                  locations={[0, 0.6, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.cardTxt}>
                  <View style={styles.lockRow}>
                    <Ionicons name="lock-closed" size={12} color={INK.steel} />
                    <Text style={styles.lockKicker}>NOT YET REMEMBERED</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: INK.steel }]}>???</Text>
                  {s.unlock.type === "beat" && (
                    <Text style={styles.lockHint}>{s.unlock.hint}</Text>
                  )}
                </View>
              </View>
            );
          }
          return (
            <Pressable
              key={s.id}
              style={styles.card}
              onPress={() => router.push(`/story-scene?sceneId=${s.id}` as never)}
              testID={`story-card-${s.id}`}
            >
              <ExpoImage source={s.art} style={styles.cardArt} contentFit="cover" transition={250} />
              <LinearGradient
                colors={["rgba(4,5,9,0)", "rgba(4,5,9,0.55)", "rgba(4,5,9,0.92)"]}
                locations={[0.35, 0.7, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {!seen && (
                <View style={styles.newBadge} testID={`story-new-${s.id}`}>
                  <Ionicons name="sparkles" size={10} color={INK.black} />
                  <Text style={styles.newBadgeTxt}>NEW</Text>
                </View>
              )}
              <View style={styles.cardTxt}>
                <Text style={styles.cardKicker}>{s.kicker}</Text>
                <Text style={styles.cardTitle}>{s.title}</Text>
              </View>
            </Pressable>
          );
        })}
        <Text style={styles.galleryNote}>
          Quiet moments from the story so far. Viewing a memory changes nothing — it is only remembering.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK.black },
  safe: { flex: 1, justifyContent: "space-between", padding: SPACING.lg },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  topActions: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  skipTxt: { color: INK.paper, fontSize: 13, fontWeight: "600", opacity: 0.85 },
  kicker: { color: INK.gold, fontSize: 11, fontWeight: "800", letterSpacing: 2.5 },
  title: {
    color: INK.paper, fontSize: 22, fontWeight: "300", letterSpacing: 1, marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8,
  },
  tapZone: { justifyContent: "flex-end" },
  panel: { gap: SPACING.sm },
  line: { color: INK.paper, fontSize: 15, lineHeight: 23, marginBottom: SPACING.sm },
  keeperLine: {
    color: INK.gold, fontSize: 15, lineHeight: 23, fontStyle: "italic", marginBottom: SPACING.sm,
  },
  hint: { color: INK.steel, fontSize: 11, letterSpacing: 1.2, textAlign: "center", opacity: 0.8 },

  galleryRoot: { flex: 1, backgroundColor: INK.black },
  galleryHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  galleryList: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    height: 150, borderRadius: RADIUS.lg, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(224,180,92,0.25)",
  },
  cardLocked: { borderColor: "rgba(159,180,199,0.18)" },
  cardArt: { ...StyleSheet.absoluteFillObject },
  cardArtLocked: { opacity: 0.35 },
  cardTxt: { flex: 1, justifyContent: "flex-end", padding: SPACING.md },
  cardKicker: { color: INK.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  cardTitle: { color: INK.paper, fontSize: 17, fontWeight: "600", marginTop: 2 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  lockKicker: { color: INK.steel, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  lockHint: { color: INK.steel, fontSize: 11, fontStyle: "italic", marginTop: 2, opacity: 0.85 },
  newBadge: {
    position: "absolute", top: SPACING.sm, right: SPACING.sm,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: INK.gold, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeTxt: { color: INK.black, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  galleryNote: {
    color: INK.steel, fontSize: 12, lineHeight: 18, textAlign: "center",
    fontStyle: "italic", marginTop: SPACING.sm, opacity: 0.75,
  },
});
