import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const INTRO_KEY = "clinica.intro.seen";

/* ── Arena scene definitions — element accent + orb colors for props ── */
const ARENA_SCENES: Record<string, {
  name: string;
  accent: string;
  orb1: string;
  orb2: string;
}> = {
  River:      { name: "Grand Ward Atrium",      accent: COLORS.river,      orb1: "#06B6D4", orb2: "#0e7490" },
  Air:        { name: "Healer's Garden Spire",  accent: COLORS.air,        orb1: "#B0DEFF", orb2: "#60A5FA" },
  Fire:       { name: "Alchemical Forge",       accent: COLORS.fire,       orb1: "#F97316", orb2: "#DC2626" },
  Mind:       { name: "Neural Observatory",     accent: COLORS.mind,       orb1: "#A78BFA", orb2: "#7C3AED" },
  Forge:      { name: "Osseous Hall",           accent: COLORS.forge,      orb1: "#D97706", orb2: "#92400E" },
  Energy:     { name: "Metabolic Sanctum",      accent: COLORS.energy,     orb1: "#FBBF24", orb2: "#D97706" },
  Storm:      { name: "Storm Observatory",      accent: COLORS.storm,      orb1: "#8B5CF6", orb2: "#4C1D95" },
  Filter:     { name: "Renal Depths",           accent: COLORS.filter,     orb1: "#22D3EE", orb2: "#0891B2" },
  Protection: { name: "Restoration Hall",       accent: COLORS.protection, orb1: "#34D399", orb2: "#059669" },
  Growth:     { name: "Endocrine Garden",       accent: COLORS.growth,     orb1: "#F472B6", orb2: "#BE185D" },
};

const FALLBACK_SCENE = ARENA_SCENES.River;

export default function RunHome() {
  const router  = useRouter();
  const { player, loading } = usePlayer();
  const { logEvent } = useTestSession();
  const [showIntro, setShowIntro] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setShowIntro(true); });
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.25, duration: 850, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: false }),
      Animated.delay(1600),
    ])).start();
  }, []);

  const dismissIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: COLORS.surface }} />;
  }

  if (!player) {
    return <View style={{ flex: 1, backgroundColor: COLORS.surface }} />;
  }

  const apt      = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) /
                  (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  const leadHeroId   = player.active_team?.[0] ?? "novice_guardian";
  const leadHero     = HEROES.find((h) => h.id === leadHeroId);
  const heroSprite   = getHeroSprite(leadHeroId);
  const elementColor = ELEMENT_COLORS[leadHero?.element ?? "River"] ?? COLORS.river;
  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;

  const scene = ARENA_SCENES[leadHero?.element ?? "River"] ?? FALLBACK_SCENE;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rankKicker}>{RANKS[player.rank_index].name.toUpperCase()}</Text>
          <Text style={styles.playerName}>{player.name}</Text>
        </View>
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push("/tutorial")}
          hitSlop={10}
          testID="run-tutorial-button"
        >
          <Ionicons name="help-circle-outline" size={22} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        {apt && (
          <View style={[styles.headerBtn, { borderColor: apt.color + "60" }]}>
            <Ionicons name={apt.icon as any} size={18} color={apt.color} />
          </View>
        )}
      </View>

      {/* ── SCENE LOCATION LABEL ── */}
      <View style={styles.sceneLabelRow}>
        <View style={[styles.sceneDot, { backgroundColor: scene.accent }]} />
        <Text style={[styles.sceneLabel, { color: scene.accent }]}>{scene.name.toUpperCase()}</Text>
      </View>

      {/* ── MAIN ARENA — layered: scenic bg → side cols → hero portrait ── */}
      <View style={styles.arena}>

        {/* LAYER 1 — full-width scenic background (drawn behind everything) */}
        <SceneBg element={leadHero?.element ?? "River"} scene={scene} />

        {/* LAYER 2 — side columns (float above bg, transparent backgrounds) */}

        {/* LEFT COLUMN */}
        <View style={styles.sideCol}>
          <FeatureButton
            icon="calendar-outline"
            label="Events"
            color={COLORS.air}
            locked
            lockText="Soon"
            onPress={() => {}}
          />
          <FeatureButton
            icon="shield-checkmark-outline"
            label="Daily"
            color={COLORS.mind}
            locked
            lockText="Soon"
            onPress={() => {}}
          />
        </View>

        {/* CENTER — hero portrait (plain, no frame, no pedestal, no blob) */}
        <Pressable
          style={styles.heroCenter}
          onPress={() => router.push("/hero-select")}
          testID="home-portrait-tap"
        >
          {heroSprite ? (
            <Image
              source={heroSprite}
              style={styles.heroImg}
              contentFit="contain"
              contentPosition="center"
            />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}

          {/* Tap hint — minimal pill bottom-right */}
          <Animated.View style={[styles.tapPulse, { opacity: pulseAnim }]}>
            <View style={[styles.tapDot, { backgroundColor: elementColor }]} />
            <Text style={styles.tapLabel}>tap to change</Text>
          </Animated.View>
        </Pressable>

        {/* RIGHT COLUMN */}
        <View style={styles.sideCol}>
          <FeatureButton
            icon={bossUnlocked ? "skull" : "lock-closed"}
            label="Boss"
            color={COLORS.error}
            locked={!bossUnlocked}
            lockText="1 run"
            onPress={() => { if (bossUnlocked) router.push("/boss"); }}
            testID="home-float-boss"
          />
          <FeatureButton
            icon="sparkles"
            label="Summon"
            color={COLORS.brand}
            onPress={() => router.push("/summon")}
            testID="home-float-summon"
          />
        </View>
      </View>

      {/* ── HERO INFO PANEL ── */}
      <Pressable
        style={[styles.infoPanel, { borderColor: elementColor + "35" }]}
        onPress={() => router.push("/hero-select")}
      >
        <View style={[styles.elementBadge, { borderColor: elementColor + "80", backgroundColor: elementColor + "15" }]}>
          <Text style={[styles.elementTxt, { color: elementColor }]}>{leadHero?.element ?? "River"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName}>{leadHero?.name ?? "Your Hero"}</Text>
          <Text style={styles.heroTitle}>{leadHero?.title ?? apt?.title ?? ""}</Text>
        </View>
        <View style={styles.xpCol}>
          <View style={styles.xpBg}>
            <View style={[styles.xpBar, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: elementColor }]} />
          </View>
          <Text style={styles.xpTxt}>{nextRank ? `${player.xp}/${nextRank.xpRequired} XP` : "MAX"}</Text>
        </View>
      </Pressable>

      {/* ── START SHIFT ── */}
      <Pressable
        style={styles.startBtn}
        onPress={() => { logEvent("shifting_ward_opened", "home", {}); router.push("/shift"); }}
        testID="run-random-encounter"
      >
        <Ionicons name="medical" size={18} color={COLORS.onBrand} />
        <Text style={styles.startTxt}>START SHIFT</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
      </Pressable>

      {/* ── WARD DEFENSE ENTRY ── */}
      <Pressable
        style={styles.wardDefBtn}
        onPress={() => router.push("/ward-defense")}
        testID="home-ward-defense"
      >
        <View style={styles.wardDefLeft}>
          <Text style={styles.wardDefNew}>NEW</Text>
          <Text style={styles.wardDefTitle}>Ward Defense</Text>
          <Text style={styles.wardDefSub}>Airway Rush · 5 waves + boss</Text>
        </View>
        <View style={styles.wardDefRight}>
          <Text style={{ fontSize: 28 }}>🐲</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.air + "80"} />
        </View>
      </Pressable>

      {/* ── INTRO MODAL ── */}
      <Modal visible={showIntro} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.introOverlay}>
          <View style={styles.introPanel}>
            <View style={styles.introHandle} />
            <Text style={styles.introKicker}>A KINGDOM SHAPED LIKE THE BODY</Text>
            <Text style={styles.introTitle}>Welcome to Clinica</Text>
            <Text style={styles.introBody}>
              Five great regions — Air, River, Fire, Mind, Stone — each a living body system.{"\n\n"}
              Your healer team reads patient clues, keeps Stability above zero, and drives Corruption to zero.{"\n\n"}
              <Text style={{ color: COLORS.brand }}>Fight disease. Restore the body. Learn medicine through play.</Text>
            </Text>
            <View style={styles.introSystems}>
              {[
                { name: "Air",   desc: "Lungs",  color: COLORS.air   },
                { name: "River", desc: "Heart",  color: COLORS.river },
                { name: "Fire",  desc: "Immune", color: COLORS.fire  },
                { name: "Mind",  desc: "Neuro",  color: COLORS.mind  },
                { name: "Stone", desc: "Bone",   color: COLORS.forge },
              ].map((s) => (
                <View key={s.name} style={styles.sysPill}>
                  <View style={[styles.sysDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.sysName, { color: s.color }]}>{s.name}</Text>
                  <Text style={styles.sysDesc}>{s.desc}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.introCta} onPress={dismissIntro} testID="intro-dismiss">
              <Text style={styles.introCtaTxt}>BEGIN THE JOURNEY</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════
   SCENIC BACKGROUNDS — 2.5D anime/donghua environments

   Philosophy: the SKY/ATMOSPHERE is the base canvas.
   Architecture and nature float as silhouettes inside it.
   ┌─────────────────────────────────────────────────────┐
   │  SKY    → atmospheric gradient — the world's depth  │
   │  HAZE   → soft ellipse layers between depth planes  │
   │  FAR    → distant hills/walls as organic dark blobs │
   │  MID    → gates, arches, furnaces — story anchors   │
   │  NEAR   → columns, trees — foreground framing       │
   │  LIGHT  → large soft radial bloom, not a rectangle  │
   │  GROUND → dark plane with subtle reflection strip   │
   └─────────────────────────────────────────────────────┘
   Ward accent = light sources ONLY, not room color.
   ══════════════════════════════════════════════════════════ */

type SceneProps = { o: string; a: string };

/* ── Grand Ward Atrium — vast moonlit hall, stone arch, floating orb lanterns ── */
function CentralAtrium({ o, a }: SceneProps) {
  return (
    <>
      {/* SKY CANVAS: deep midnight blue-teal */}
      <LinearGradient
        colors={["#020c1e", "#031428", "#051c38", "#051628", "#030e1c"]}
        locations={[0, 0.18, 0.45, 0.72, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* MOONLIGHT BLOOM — all within bounds (top >= 0%) */}
      <View style={{ position: "absolute", top: "0%", alignSelf: "center",
        width: "110%", height: "60%", borderRadius: 999, backgroundColor: "#4080c030" }} />
      <View style={{ position: "absolute", top: "2%", alignSelf: "center",
        width: "78%", height: "50%", borderRadius: 999, backgroundColor: "#60a0d840" }} />
      <View style={{ position: "absolute", top: "5%", alignSelf: "center",
        width: "52%", height: "38%", borderRadius: 999, backgroundColor: "#80bce850" }} />
      <View style={{ position: "absolute", top: "8%", alignSelf: "center",
        width: "30%", height: "24%", borderRadius: 999, backgroundColor: "#a0d0f055" }} />

      {/* ARCH PORTAL: open to night sky */}
      <View style={{ position: "absolute", top: "6%", alignSelf: "center",
        width: "44%", height: "62%",
        borderTopLeftRadius: 999, borderTopRightRadius: 999, overflow: "hidden" }}>
        <LinearGradient colors={["#051020","#071830","#051428"]} locations={[0,0.5,1]} style={{ flex: 1 }} />
        {[{t:"8%",l:"18%"},{t:"15%",l:"55%"},{t:"10%",l:"76%"},{t:"26%",l:"32%"},
          {t:"22%",l:"68%"},{t:"32%",l:"46%"},{t:"7%",l:"44%"},{t:"19%",l:"82%"},
          {t:"5%",l:"60%"},{t:"35%",l:"24%"}].map((d,i)=>(
          <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any,
            width: i%3===0?2.5:1.5, height: i%3===0?2.5:1.5, borderRadius: 2,
            backgroundColor: i%2===0?"#e8f4ff":"#d0e8ff", opacity: i%3===0?0.9:0.6 }} />
        ))}
        <View style={{ position: "absolute", top: "8%", left: "52%",
          width: 26, height: 26, borderRadius: 13, backgroundColor: "#ddeeff", opacity: 0.70 }} />
        <View style={{ position: "absolute", top: "6%", left: "50%",
          width: 34, height: 34, borderRadius: 17, backgroundColor: "#c0d8f050" }} />
        <LinearGradient colors={["#c0d8f055","#c0d0f018","#00000000"]}
          style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "75%" }} />
      </View>
      {/* Arch border + glow */}
      <View style={{ position: "absolute", top: "6%", alignSelf: "center",
        width: "44%", height: "62%", borderTopLeftRadius: 999, borderTopRightRadius: 999,
        borderWidth: 2, borderColor: "#204060", borderBottomWidth: 0, backgroundColor: "transparent" }} />
      <LinearGradient colors={[o+"60",o+"20","#00000000"]}
        style={{ position: "absolute", top: "6%", alignSelf: "center",
          width: "62%", height: "46%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />

      {/* MID PIERS */}
      <View style={{ position: "absolute", left: "18%", top: 0, width: "8%", height: "70%",
        backgroundColor: "#020810" }} />
      <View style={{ position: "absolute", right: "18%", top: 0, width: "8%", height: "70%",
        backgroundColor: "#020810" }} />

      {/* FOREGROUND COLUMNS */}
      <View style={{ position: "absolute", left: 0, top: 0, width: "15%", height: "76%",
        backgroundColor: "#010408" }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: "15%", height: "76%",
        backgroundColor: "#010408" }} />
      <View style={{ position: "absolute", left: 0, top: 0, width: "18%", height: "4%",
        backgroundColor: "#010306" }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: "18%", height: "4%",
        backgroundColor: "#010306" }} />

      {/* LEFT HANGING ORB LANTERN — round, no rectangles */}
      <View style={{ position: "absolute", left: "9%", top: "16%", width: 2, height: "16%",
        backgroundColor: "#1a3050" }} />
      <View style={{ position: "absolute", left: "6%", top: "30%",
        width: 26, height: 26, borderRadius: 13, backgroundColor: o+"88" }} />
      <View style={{ position: "absolute", left: "6%", top: "30%",
        width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff8d044" }} />
      <LinearGradient colors={[o+"55",o+"22","#00000000"]}
        style={{ position: "absolute", left: "2%", top: "26%",
          width: "22%", height: "34%", borderRadius: 999 }} />

      {/* RIGHT HANGING ORB LANTERN */}
      <View style={{ position: "absolute", right: "9%", top: "16%", width: 2, height: "16%",
        backgroundColor: "#1a3050" }} />
      <View style={{ position: "absolute", right: "6%", top: "30%",
        width: 26, height: 26, borderRadius: 13, backgroundColor: o+"88" }} />
      <View style={{ position: "absolute", right: "6%", top: "30%",
        width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff8d044" }} />
      <LinearGradient colors={[o+"55",o+"22","#00000000"]}
        style={{ position: "absolute", right: "2%", top: "26%",
          width: "22%", height: "34%", borderRadius: 999 }} />

      {/* IV POLE midground — orb on top */}
      <View style={{ position: "absolute", left: "28%", top: 0, width: 2, height: "64%",
        backgroundColor: "#1e3450" }} />
      <View style={{ position: "absolute", left: "26%", top: "5%",
        width: 12, height: 12, borderRadius: 6, backgroundColor: o+"55" }} />

      {/* DUST MOTES in moonbeam */}
      {[{t:"26%",l:"37%"},{t:"18%",l:"57%"},{t:"38%",l:"45%"},
        {t:"32%",l:"63%"},{t:"22%",l:"32%"},{t:"44%",l:"52%"}].map((p,i)=>(
        <View key={i} style={{ position: "absolute", top: p.t as any, left: p.l as any,
          width: 2, height: 2, borderRadius: 1,
          backgroundColor: o, opacity: i%2===0?0.45:0.28 }} />
      ))}

      {/* GROUND: polished stone */}
      <LinearGradient colors={["#020a16","#050f1e"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%" }} />
      <View style={{ position: "absolute", bottom: "27%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff12" }} />
      <View style={{ position: "absolute", bottom: "18%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0a" }} />
      <View style={{ position: "absolute", bottom: "10%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff07" }} />
      <LinearGradient colors={["#00000000",o+"25","#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "28%", left: "16%", right: "16%", height: 6, borderRadius: 999 }} />
    </>
  );
}

/* ── Sky Clinic Courtyard — open rooftop at dusk, cherry trees, temple gate, mountain silhouettes ── */
function HealerGardenScene({ o, a }: SceneProps) {
  return (
    <>
      {/* SKY CANVAS: visible twilight gradient — dusk purple→amber */}
      <LinearGradient
        colors={["#060218","#0f0630","#1c0a42","#2a1238","#34141c","#200e10","#0c0a10"]}
        locations={[0, 0.12, 0.28, 0.46, 0.64, 0.82, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* WARM AMBER HORIZON BAND */}
      <LinearGradient
        colors={["#00000000","#3a1408","#5a2410","#4a1c0c","#00000000"]}
        locations={[0, 0.28, 0.5, 0.7, 1]}
        style={{ position: "absolute", top: "30%", left: 0, right: 0, height: "30%" }}
      />
      {/* AIR bloom — atmospheric light from top center */}
      <View style={{ position: "absolute", top: "0%", alignSelf: "center",
        width: "80%", height: "45%", borderRadius: 999, backgroundColor: o+"28" }} />
      <View style={{ position: "absolute", top: "2%", alignSelf: "center",
        width: "50%", height: "32%", borderRadius: 999, backgroundColor: o+"35" }} />

      {/* STARS: visible across dusk sky */}
      {[{t:"4%",l:"9%"},{t:"8%",l:"27%"},{t:"5%",l:"51%"},{t:"11%",l:"70%"},{t:"14%",l:"86%"},
        {t:"3%",l:"42%"},{t:"7%",l:"80%"},{t:"16%",l:"19%"},{t:"2%",l:"62%"}].map((d,i)=>(
        <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any,
          width: i%3===0?2.5:1.5, height: i%3===0?2.5:1.5, borderRadius: 2,
          backgroundColor: i%2===0?"#e0d8ff":"#d0c8ff", opacity: i%3===0?0.80:0.50 }} />
      ))}
      <View style={{ position: "absolute", top: "5%", right: "20%",
        width: 18, height: 18, borderRadius: 9, backgroundColor: "#e8dcc8", opacity: 0.55 }} />
      <View style={{ position: "absolute", top: "4%", right: "19%",
        width: 24, height: 24, borderRadius: 12, backgroundColor: "#e0d4b840" }} />

      {/* DISTANT MOUNTAINS: large organic silhouette blobs */}
      <View style={{ position: "absolute", top: "34%", left: "-14%", width: "52%", height: "26%",
        borderRadius: 999, backgroundColor: "#050310", opacity: 0.90 }} />
      <View style={{ position: "absolute", top: "27%", left: "14%", width: "60%", height: "34%",
        borderRadius: 999, backgroundColor: "#070416", opacity: 0.88 }} />
      <View style={{ position: "absolute", top: "32%", right: "-14%", width: "50%", height: "28%",
        borderRadius: 999, backgroundColor: "#050310", opacity: 0.85 }} />
      <LinearGradient colors={["#00000000",o+"18","#00000000"]}
        style={{ position: "absolute", top: "48%", left: 0, right: 0, height: "12%" }} />

      {/* TEMPLE GATE: clean arch silhouette */}
      <View style={{ position: "absolute", top: "38%", alignSelf: "center",
        marginLeft: -38, width: 9, height: "28%", backgroundColor: "#030110" }} />
      <View style={{ position: "absolute", top: "38%", alignSelf: "center",
        marginLeft: 38, width: 9, height: "28%", backgroundColor: "#030110" }} />
      <View style={{ position: "absolute", top: "36%", alignSelf: "center",
        width: "30%", height: 10, backgroundColor: "#030110", borderRadius: 2 }} />
      <View style={{ position: "absolute", top: "38%", alignSelf: "center",
        width: "26%", height: 6, backgroundColor: "#040218", borderRadius: 1 }} />
      <LinearGradient colors={["#00000000",o+"22","#00000000"]}
        style={{ position: "absolute", top: "39%", alignSelf: "center",
          width: "30%", height: "26%", borderRadius: 999 }} />

      {/* LEFT: CHERRY BLOSSOM TREE */}
      <View style={{ position: "absolute", left: "4%", top: "44%", width: 13, height: "30%",
        backgroundColor: "#08060e", borderRadius: 6 }} />
      <View style={{ position: "absolute", left: "6%", top: "32%", width: 8, height: "18%",
        backgroundColor: "#0a0810", borderRadius: 4, transform: [{ rotate: "-14deg" }] }} />
      {/* Organic canopy — 6 overlapping round blobs */}
      <View style={{ position: "absolute", left: "-10%", top: "12%", width: "30%", height: "24%",
        borderRadius: 999, backgroundColor: "#16091e", opacity: 0.92 }} />
      <View style={{ position: "absolute", left: "2%", top: "6%", width: "26%", height: "22%",
        borderRadius: 999, backgroundColor: "#1c0c26", opacity: 0.88 }} />
      <View style={{ position: "absolute", left: "-6%", top: "26%", width: "24%", height: "20%",
        borderRadius: 999, backgroundColor: "#12061c", opacity: 0.84 }} />
      <View style={{ position: "absolute", left: "10%", top: "16%", width: "20%", height: "18%",
        borderRadius: 999, backgroundColor: "#200c2e", opacity: 0.80 }} />
      <View style={{ position: "absolute", left: "4%", top: "28%", width: "18%", height: "16%",
        borderRadius: 999, backgroundColor: "#18082a", opacity: 0.75 }} />
      <View style={{ position: "absolute", left: "-4%", top: "18%", width: "22%", height: "18%",
        borderRadius: 999, backgroundColor: "#14081e", opacity: 0.70 }} />
      {/* Blossom warm glow */}
      <LinearGradient colors={["#c060a0","#00000000"]}
        style={{ position: "absolute", left: "-4%", top: "8%",
          width: "30%", height: "30%", borderRadius: 999, opacity: 0.20 }} />
      {/* Falling petals */}
      {[{t:"36%",l:"14%"},{t:"42%",l:"8%"},{t:"39%",l:"22%"},{t:"37%",l:"28%"},{t:"44%",l:"18%"}].map((p,i)=>(
        <View key={i} style={{ position: "absolute", top: p.t as any, left: p.l as any,
          width: 3, height: 2, borderRadius: 2, backgroundColor: "#d080a0", opacity: 0.45,
          transform: [{ rotate: `${i*35}deg` }] }} />
      ))}

      {/* RIGHT: BAMBOO GROVE + ROUND GLOW ORB */}
      <View style={{ position: "absolute", right: "5%", top: "14%", width: 10, height: "62%",
        backgroundColor: "#0c1808", borderRadius: 5 }} />
      <View style={{ position: "absolute", right: "9%", top: "20%", width: 8, height: "56%",
        backgroundColor: "#0a1606", borderRadius: 4 }} />
      <View style={{ position: "absolute", right: "3%", top: "22%", width: 6, height: "50%",
        backgroundColor: "#0e1a0a", borderRadius: 3 }} />
      <View style={{ position: "absolute", right: "2%", top: "10%", width: "17%", height: "14%",
        borderRadius: 999, backgroundColor: "#0e1c0a", opacity: 0.80 }} />
      <View style={{ position: "absolute", right: "5%", top: "20%", width: "14%", height: "12%",
        borderRadius: 999, backgroundColor: "#0c1a08", opacity: 0.72 }} />
      <View style={{ position: "absolute", right: "0%", top: "30%", width: "16%", height: "12%",
        borderRadius: 999, backgroundColor: "#0a1806", opacity: 0.65 }} />
      {/* Floating round orb — no box lantern */}
      <View style={{ position: "absolute", right: "20%", top: "48%", width: 2, height: "24%",
        backgroundColor: "#1c1828" }} />
      <View style={{ position: "absolute", right: "18%", top: "50%",
        width: 20, height: 20, borderRadius: 10, backgroundColor: o+"70" }} />
      <View style={{ position: "absolute", right: "18%", top: "50%",
        width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff8f020" }} />
      <LinearGradient colors={[o+"45","#00000000"]}
        style={{ position: "absolute", right: "12%", top: "46%",
          width: "18%", height: "28%", borderRadius: 999 }} />

      {/* GROUND: garden path */}
      <LinearGradient colors={["#06040c","#0a0812"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
      <LinearGradient colors={["#00000000","#604080","#00000000"]}
        style={{ position: "absolute", bottom: "26%", left: 0, right: 0, height: "8%", opacity: 0.10 }} />
      <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0e" }} />
      <View style={{ position: "absolute", bottom: "16%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0a" }} />
    </>
  );
}

/* ── Alchemical Forge — volcanic cavern, forge furnace, torches, ember sparks ── */
function AlchemicalForgeScene({ o, a }: SceneProps) {
  return (
    <>
      {/* SKY CANVAS: deep amber-red cave warmth */}
      <LinearGradient
        colors={["#0a0402","#140802","#1e0c04","#160a02","#0c0602"]}
        locations={[0, 0.22, 0.50, 0.74, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* THE FORGE GLOW: massive radial bloom */}
      <View style={{ position: "absolute", top: "5%", alignSelf: "center",
        width: "100%", height: "68%", borderRadius: 999, backgroundColor: o+"18" }} />
      <View style={{ position: "absolute", top: "12%", alignSelf: "center",
        width: "76%", height: "54%", borderRadius: 999, backgroundColor: o+"25" }} />
      <View style={{ position: "absolute", top: "20%", alignSelf: "center",
        width: "52%", height: "38%", borderRadius: 999, backgroundColor: o+"32" }} />
      <View style={{ position: "absolute", top: "28%", alignSelf: "center",
        width: "30%", height: "22%", borderRadius: 999, backgroundColor: o+"40" }} />

      {/* CAVE ARCH CEILING */}
      <View style={{ position: "absolute", left: 0, top: 0, width: "20%", height: "52%",
        backgroundColor: "#060200" }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: "20%", height: "52%",
        backgroundColor: "#060200" }} />
      <View style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: "9%",
        backgroundColor: "#060400" }} />
      <View style={{ position: "absolute", top: "9%", alignSelf: "center",
        width: "54%", height: "16%", borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
        backgroundColor: "#050300" }} />

      {/* LEFT TORCH + ROUND GLOW ORB */}
      <View style={{ position: "absolute", left: "18%", top: "22%", width: "10%", height: "3%",
        backgroundColor: "#2c1808", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "21%", top: "12%", width: 3, height: "12%",
        backgroundColor: "#3a2010" }} />
      <View style={{ position: "absolute", left: "19%", top: "5%",
        width: 22, height: 22, borderRadius: 11, backgroundColor: o+"cc" }} />
      <View style={{ position: "absolute", left: "19%", top: "3%",
        width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff8e090" }} />
      <LinearGradient colors={[o+"66",o+"28","#00000000"]}
        style={{ position: "absolute", left: "10%", top: "0%",
          width: "26%", height: "40%", borderRadius: 999 }} />

      {/* RIGHT TORCH + ROUND GLOW ORB */}
      <View style={{ position: "absolute", right: "18%", top: "22%", width: "10%", height: "3%",
        backgroundColor: "#2c1808", borderRadius: 2 }} />
      <View style={{ position: "absolute", right: "21%", top: "12%", width: 3, height: "12%",
        backgroundColor: "#3a2010" }} />
      <View style={{ position: "absolute", right: "19%", top: "5%",
        width: 22, height: 22, borderRadius: 11, backgroundColor: o+"cc" }} />
      <View style={{ position: "absolute", right: "19%", top: "3%",
        width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff8e090" }} />
      <LinearGradient colors={[o+"66",o+"28","#00000000"]}
        style={{ position: "absolute", right: "10%", top: "0%",
          width: "26%", height: "40%", borderRadius: 999 }} />

      {/* FORGE FURNACE: stone dome */}
      <View style={{ position: "absolute", bottom: "28%", alignSelf: "center",
        width: "46%", height: "26%", borderTopLeftRadius: 999, borderTopRightRadius: 999,
        backgroundColor: "#0c0804" }} />
      <LinearGradient colors={[o+"70",o+"38","#00000000"]}
        style={{ position: "absolute", bottom: "50%", alignSelf: "center",
          width: "28%", height: "16%", borderRadius: 999 }} />
      <LinearGradient colors={[o+"50",o+"28",o+"0e","#00000000"]}
        style={{ position: "absolute", bottom: "52%", alignSelf: "center",
          width: "16%", height: "32%", borderRadius: 999 }} />
      <LinearGradient colors={[o+"30",o+"12","#00000000"]}
        style={{ position: "absolute", bottom: "62%", alignSelf: "center",
          width: "8%", height: "26%", borderRadius: 999 }} />

      {/* EMBER SPARKS */}
      {[{t:"20%",l:"35%"},{t:"12%",l:"50%"},{t:"16%",l:"57%"},{t:"24%",l:"42%"},
        {t:"8%",l:"46%"},{t:"28%",l:"54%"},{t:"14%",l:"44%"},{t:"18%",l:"62%"}].map((p,i)=>(
        <View key={i} style={{ position: "absolute", top: p.t as any, left: p.l as any,
          width: i%3===0?3:2, height: i%3===0?3:2, borderRadius: 2,
          backgroundColor: i%2===0?o:"#fff4e0", opacity: i%2===0?0.85:0.65 }} />
      ))}

      {/* GROUND: dark stone with forge-light reflection */}
      <LinearGradient colors={["#080402","#0c0602"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
      <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0e" }} />
      <View style={{ position: "absolute", bottom: "16%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <LinearGradient colors={["#00000000",o+"20","#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "26%", left: "24%", right: "24%", height: 6, borderRadius: 999 }} />
    </>
  );
}

/* ── Neural Observatory — space dome, star field, holographic rings, aurora, data pillars ── */
function NeuralObservatoryScene({ o, a }: SceneProps) {
  return (
    <>
      {/* SKY CANVAS: visible deep space purple-violet */}
      <LinearGradient
        colors={["#04020e","#08051c","#0e082e","#0a061e","#060410"]}
        locations={[0, 0.22, 0.50, 0.74, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* NEBULA COLOR WASHES — large organic blobs */}
      <LinearGradient colors={["#1e0838","#00000000"]}
        style={{ position: "absolute", top: "4%", left: "-16%", width: "58%", height: "48%",
          borderRadius: 999, opacity: 0.60 }} />
      <LinearGradient colors={["#0a1438","#00000000"]}
        style={{ position: "absolute", top: "2%", right: "-16%", width: "58%", height: "54%",
          borderRadius: 999, opacity: 0.55 }} />
      {/* Central mind bloom — all within bounds */}
      <View style={{ position: "absolute", top: "0%", alignSelf: "center",
        width: "80%", height: "55%", borderRadius: 999, backgroundColor: o+"20" }} />
      <View style={{ position: "absolute", top: "3%", alignSelf: "center",
        width: "54%", height: "38%", borderRadius: 999, backgroundColor: o+"2e" }} />
      <View style={{ position: "absolute", top: "8%", alignSelf: "center",
        width: "32%", height: "24%", borderRadius: 999, backgroundColor: o+"38" }} />

      {/* STAR FIELD: visible stars */}
      {[{t:"3%",l:"8%"},{t:"7%",l:"22%"},{t:"5%",l:"46%"},{t:"9%",l:"62%"},{t:"4%",l:"78%"},
        {t:"12%",l:"90%"},{t:"17%",l:"36%"},{t:"21%",l:"72%"},{t:"14%",l:"14%"},{t:"23%",l:"56%"},
        {t:"2%",l:"34%"},{t:"8%",l:"54%"},{t:"19%",l:"80%"},{t:"11%",l:"42%"},{t:"6%",l:"66%"}].map((d,i)=>(
        <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any,
          width: i%4===0?3:1.5, height: i%4===0?3:1.5, borderRadius: 2,
          backgroundColor: i%3===0?"#e0d8ff":i%3===1?"#c8e4ff":"#f0e8ff",
          opacity: i%4===0?0.95:0.65 }} />
      ))}

      {/* AURORA BANDS — visible horizontal sweeps */}
      <LinearGradient colors={["#00000000",o+"22","#00000000"]}
        locations={[0, 0.5, 1]}
        style={{ position: "absolute", top: "24%", left: 0, right: 0, height: "12%" }} />
      <LinearGradient colors={["#00000000","#2060b0","#00000000"]}
        locations={[0, 0.5, 1]}
        style={{ position: "absolute", top: "32%", left: 0, right: 0, height: "8%", opacity: 0.18 }} />

      {/* DOME RINGS: holographic observatory */}
      <View style={{ position: "absolute", alignSelf: "center", top: "0%",
        width: "88%", aspectRatio: 1, borderRadius: 999, borderWidth: 1.5, borderColor: o+"40" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "4%",
        width: "64%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderColor: o+"32" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "9%",
        width: "44%", aspectRatio: 1, borderRadius: 999, borderWidth: 0.5, borderColor: o+"25" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "36%",
        left: "14%", right: "14%", height: 0.5, backgroundColor: o+"28" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "0%",
        width: 0.5, height: "46%", backgroundColor: o+"20" }} />
      {/* Central focal orb — bright */}
      <View style={{ position: "absolute", alignSelf: "center", top: "30%",
        width: 14, height: 14, borderRadius: 7, backgroundColor: o }} />
      <LinearGradient colors={[o+"70","#00000000"]}
        style={{ position: "absolute", alignSelf: "center", top: "25%",
          width: "20%", aspectRatio: 1, borderRadius: 999 }} />

      {/* DARK PILLAR MASSES on sides */}
      <View style={{ position: "absolute", left: 0, top: 0, width: "12%", height: "68%",
        backgroundColor: "#030110" }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: "12%", height: "68%",
        backgroundColor: "#030110" }} />
      {[28, 38, 48, 58].map((t,i)=>(
        <View key={i} style={{ position: "absolute", left: "2%", top: `${t}%`,
          width: "8%", height: 1, backgroundColor: o, opacity: 0.22 }} />
      ))}
      {[28, 38, 48, 58].map((t,i)=>(
        <View key={i} style={{ position: "absolute", right: "2%", top: `${t}%`,
          width: "8%", height: 1, backgroundColor: o, opacity: 0.22 }} />
      ))}
      <LinearGradient colors={[o+"25","#00000000"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }}
        style={{ position: "absolute", left: "12%", top: "8%", width: "10%", height: "52%" }} />
      <LinearGradient colors={[o+"25","#00000000"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", right: "12%", top: "8%", width: "10%", height: "52%" }} />

      {/* DATA ORBS */}
      {[{t:"34%",l:"22%",s:9},{t:"26%",l:"70%",s:7},{t:"44%",l:"58%",s:7}].map((p,i)=>(
        <View key={i} style={{ position: "absolute", top: p.t as any, left: p.l as any,
          width: p.s, height: p.s, borderRadius: p.s,
          backgroundColor: o, opacity: i%2===0?0.80:0.60 }} />
      ))}

      {/* GROUND */}
      <LinearGradient colors={["#030212","#060418"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
      <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: o, opacity: 0.14 }} />
      <View style={{ position: "absolute", bottom: "16%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
    </>
  );
}

/* ── Restoration Hall — ancient healing temple, rose window god-rays, stone columns, altar ── */
function RestorationHallScene({ o, a }: SceneProps) {
  return (
    <>
      {/* SKY CANVAS: warm amber-stone ancient atmosphere */}
      <LinearGradient
        colors={["#0a0806","#120e08","#180c06","#120a06","#0a0806"]}
        locations={[0, 0.24, 0.52, 0.76, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* GOD RAY SOURCE BLOOM — all within bounds */}
      <View style={{ position: "absolute", top: "0%", alignSelf: "center",
        width: "84%", height: "52%", borderRadius: 999, backgroundColor: o+"18" }} />
      <View style={{ position: "absolute", top: "2%", alignSelf: "center",
        width: "56%", height: "38%", borderRadius: 999, backgroundColor: o+"24" }} />
      <View style={{ position: "absolute", top: "5%", alignSelf: "center",
        width: "34%", height: "24%", borderRadius: 999, backgroundColor: o+"32" }} />

      {/* ROSE WINDOW: round, ornate, visible center focal point */}
      <View style={{ position: "absolute", top: "7%", alignSelf: "center",
        width: "30%", aspectRatio: 1, borderRadius: 999,
        borderWidth: 3, borderColor: "#2e2210", backgroundColor: "#100c08" }}>
        <View style={{ position: "absolute", top: "16%", bottom: "16%", left: "16%", right: "16%",
          borderRadius: 999, borderWidth: 2, borderColor: "#3e2e14" }} />
        {[0, 60, 120].map((deg,i)=>(
          <View key={i} style={{ position: "absolute", alignSelf: "center", top: "44%",
            width: 1.5, height: "56%", backgroundColor: "#3e2e14",
            transform: [{ rotate: `${deg}deg` }] }} />
        ))}
        <LinearGradient colors={[o+"45",o+"18"]} style={{ flex: 1, borderRadius: 999 }} />
      </View>

      {/* GOD RAYS beaming down — wider and more visible */}
      <LinearGradient colors={[o+"35","#00000000"]}
        style={{ position: "absolute", top: "22%", alignSelf: "center",
          width: "6%", height: "62%", borderRadius: 999, opacity: 0.80 }} />
      <LinearGradient colors={[o+"28","#00000000"]}
        style={{ position: "absolute", top: "20%", alignSelf: "center",
          marginLeft: 28, width: "4.5%", height: "54%", borderRadius: 999, opacity: 0.65 }} />
      <LinearGradient colors={[o+"28","#00000000"]}
        style={{ position: "absolute", top: "20%", alignSelf: "center",
          marginLeft: -28, width: "4.5%", height: "54%", borderRadius: 999, opacity: 0.65 }} />
      <LinearGradient colors={[o+"1c","#00000000"]}
        style={{ position: "absolute", top: "18%", alignSelf: "center",
          marginLeft: 54, width: "3.5%", height: "46%", borderRadius: 999, opacity: 0.50 }} />
      <LinearGradient colors={[o+"1c","#00000000"]}
        style={{ position: "absolute", top: "18%", alignSelf: "center",
          marginLeft: -54, width: "3.5%", height: "46%", borderRadius: 999, opacity: 0.50 }} />

      {/* MASSIVE STONE COLUMNS: LEFT */}
      <View style={{ position: "absolute", left: 0, top: 0, width: "18%", height: "76%",
        backgroundColor: "#040200" }} />
      <View style={{ position: "absolute", left: 0, top: 0, width: "21%", height: "4.5%",
        backgroundColor: "#030200" }} />
      <View style={{ position: "absolute", left: 0, bottom: "26%", width: "21%", height: "3.5%",
        backgroundColor: "#030200" }} />
      <LinearGradient colors={[o+"28","#00000000"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }}
        style={{ position: "absolute", left: "18%", top: "8%", width: "10%", height: "56%" }} />
      {/* Round orb lantern — no box */}
      <View style={{ position: "absolute", left: "12%", top: "20%", width: 2, height: "14%",
        backgroundColor: "#1a1208" }} />
      <View style={{ position: "absolute", left: "9.5%", top: "32%",
        width: 20, height: 20, borderRadius: 10, backgroundColor: o+"88" }} />
      <View style={{ position: "absolute", left: "9.5%", top: "32%",
        width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff8e030" }} />
      <LinearGradient colors={[o+"55","#00000000"]}
        style={{ position: "absolute", left: "5%", top: "30%",
          width: "20%", height: "30%", borderRadius: 999 }} />

      {/* MASSIVE STONE COLUMNS: RIGHT */}
      <View style={{ position: "absolute", right: 0, top: 0, width: "18%", height: "76%",
        backgroundColor: "#040200" }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: "21%", height: "4.5%",
        backgroundColor: "#030200" }} />
      <View style={{ position: "absolute", right: 0, bottom: "26%", width: "21%", height: "3.5%",
        backgroundColor: "#030200" }} />
      <LinearGradient colors={[o+"28","#00000000"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", right: "18%", top: "8%", width: "10%", height: "56%" }} />
      <View style={{ position: "absolute", right: "12%", top: "20%", width: 2, height: "14%",
        backgroundColor: "#1a1208" }} />
      <View style={{ position: "absolute", right: "9.5%", top: "32%",
        width: 20, height: 20, borderRadius: 10, backgroundColor: o+"88" }} />
      <View style={{ position: "absolute", right: "9.5%", top: "32%",
        width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff8e030" }} />
      <LinearGradient colors={[o+"55","#00000000"]}
        style={{ position: "absolute", right: "5%", top: "30%",
          width: "20%", height: "30%", borderRadius: 999 }} />

      {/* CENTRAL ALTAR */}
      <View style={{ position: "absolute", bottom: "28%", alignSelf: "center",
        width: "46%", height: "5%", backgroundColor: "#0e0a06", borderRadius: 4 }} />
      <View style={{ position: "absolute", bottom: "33%", alignSelf: "center",
        width: "40%", height: "3.5%", backgroundColor: "#100c08", borderRadius: 3 }} />
      <LinearGradient colors={[o+"50","#00000000"]}
        style={{ position: "absolute", bottom: "32%", alignSelf: "center",
          width: "36%", height: "22%", borderRadius: 999 }} />
      {/* Altar candles — round orbs */}
      {[-22,-7,7,22].map((ml,i)=>(
        <View key={i}>
          <View style={{ position: "absolute", bottom: "32%", alignSelf: "center",
            marginLeft: ml*3, width: 3, height: i%2===0?"7%":"9%", backgroundColor: "#ccaa5088" }} />
          <View style={{ position: "absolute", bottom: "40%", alignSelf: "center",
            marginLeft: ml*3, width: 7, height: 7, borderRadius: 4,
            backgroundColor: i%2===0?o:"#ffcc70", opacity: 0.90 }} />
          <LinearGradient colors={[i%2===0?o+"45":"#ffcc4030","#00000000"]}
            style={{ position: "absolute", bottom: "40%", alignSelf: "center",
              marginLeft: ml*3, width: 18, height: 18, borderRadius: 999 }} />
        </View>
      ))}

      {/* GROUND: ancient polished stone */}
      <LinearGradient colors={["#060400","#0a0806"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
      <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff10" }} />
      <View style={{ position: "absolute", bottom: "17%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0a" }} />
      <View style={{ position: "absolute", bottom: "10%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff07" }} />
      <LinearGradient colors={["#00000000",o+"18","#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "26%", left: "22%", right: "22%", height: 6, borderRadius: 999 }} />
    </>
  );
}

/* ── SceneBg wrapper — five-environment compositor ── */
function SceneBg({
  element, scene,
}: {
  element: string;
  scene: { accent: string; orb1: string; orb2: string };
}) {
  const o = scene.orb1;
  const a = scene.accent;

  return (
    <>
      {/* LAYER 1 — universal near-black neutral base */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#06080c" }]} />

      {/* LAYER 2 — environment scene */}
      {element === "River"                               && <CentralAtrium           o={o} a={a} />}
      {element === "Air"                                 && <HealerGardenScene        o={o} a={a} />}
      {element === "Fire"                                && <AlchemicalForgeScene     o={o} a={a} />}
      {element === "Mind"                                && <NeuralObservatoryScene   o={o} a={a} />}
      {!["River","Air","Fire","Mind"].includes(element)  && <RestorationHallScene     o={o} a={a} />}

      {/* LAYER 3a — hero ground shadow */}
      <LinearGradient
        colors={["#00000000", "rgba(4,6,10,0.55)"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "38%" }}
      />
      <View style={{ position: "absolute", bottom: "1%", left: "28%", right: "28%", height: 18,
        borderRadius: 999, backgroundColor: "rgba(4,6,10,0.50)" }} />

      {/* LAYER 3b — edge depth vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.45)", "rgba(4,6,10,0.0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeLeft} />
      <LinearGradient colors={["rgba(4,6,10,0.0)", "rgba(4,6,10,0.45)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeRight} />

      {/* LAYER 3c — top vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.40)", "rgba(4,6,10,0.0)"]} style={sc.topVignette} />
    </>
  );
}

/** Shared structural styles for SceneBg */
const sc = StyleSheet.create({
  edgeLeft:    { position: "absolute", top: 0, bottom: 0, left: 0,  width: "18%" },
  edgeRight:   { position: "absolute", top: 0, bottom: 0, right: 0, width: "18%" },
  topVignette: { position: "absolute", top: 0, left: 0, right: 0,   height: "22%" },
});

/* ── FeatureButton ── */
function FeatureButton({
  icon, label, color, locked, lockText, onPress, testID,
}: {
  icon: string; label: string; color: string;
  locked?: boolean; lockText?: string;
  onPress: () => void; testID?: string;
}) {
  return (
    <Pressable style={[styles.featBtn, locked && { opacity: 0.5 }]} onPress={onPress} testID={testID} hitSlop={6}>
      <View style={[styles.featCircle, {
        borderColor: locked ? COLORS.border : color + "70",
        backgroundColor: locked ? COLORS.surfaceTertiary : color + "18",
      }]}>
        <Ionicons name={icon as any} size={22} color={locked ? COLORS.onSurfaceTertiary : color} />
      </View>
      <Text style={[styles.featLabel, { color: locked ? COLORS.onSurfaceTertiary : color }]}>{label}</Text>
      {locked && lockText ? <Text style={styles.featLock}>{lockText}</Text> : null}
    </Pressable>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs, paddingBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  rankKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  playerName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "300" },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },

  /* Scene label */
  sceneLabelRow: {
    flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: SPACING.lg, paddingBottom: 4,
  },
  sceneDot:  { width: 5, height: 5, borderRadius: 3 },
  sceneLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  /* Arena — fills remaining vertical space */
  arena: { flex: 1, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },

  /* Side columns */
  sideCol: { width: 72, justifyContent: "space-evenly", alignItems: "center", paddingVertical: SPACING.sm },
  featBtn:    { alignItems: "center", gap: 4 },
  featCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  featLabel:  { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textAlign: "center" },
  featLock:   { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  /* Hero center — transparent, no frame or pedestal */
  heroCenter: { flex: 1, position: "relative" },
  heroImg:        { flex: 1, width: "100%" },
  heroPlaceholder:{ flex: 1, backgroundColor: "transparent" },

  /* Tap hint */
  tapPulse: {
    position: "absolute", bottom: SPACING.sm, right: SPACING.sm,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(12,14,18,0.55)",
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  tapDot:   { width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  tapLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Hero info panel */
  infoPanel: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1,
  },
  elementBadge: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "center" },
  elementTxt:   { fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  heroName:     { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  heroTitle:    { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 1 },
  xpCol:        { alignItems: "flex-end", gap: 3 },
  xpBg:         { width: 64, height: 3, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  xpBar:        { height: "100%", borderRadius: 2 },
  xpTxt:        { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Start button */
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  startTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  /* Ward Defense card */
  wardDefBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.air + "40",
    backgroundColor: COLORS.surfaceSecondary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  wardDefLeft:  { flex: 1, gap: 2 },
  wardDefNew:   { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  wardDefTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  wardDefSub:   { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  wardDefRight: { flexDirection: "row", alignItems: "center", gap: 4 },

  /* Intro modal */
  introOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  introPanel: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
    borderTopWidth: 1, borderColor: COLORS.brand + "40",
    gap: SPACING.md,
  },
  introHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.sm },
  introKicker:  { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  introTitle:   { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  introBody:    { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
  introSystems: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  sysPill:  { alignItems: "center", gap: 3, minWidth: 46 },
  sysDot:   { width: 8, height: 8, borderRadius: 4 },
  sysName:  { fontSize: 11, fontWeight: "700" },
  sysDesc:  { color: COLORS.onSurfaceTertiary, fontSize: 9 },
  introCta: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: "center", marginTop: SPACING.sm,
  },
  introCtaTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
