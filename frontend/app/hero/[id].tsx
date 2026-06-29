import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Dimensions, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const TABS = ["Details", "Skills", "Upgrade", "Bond", "Lore"] as const;
type Tab = typeof TABS[number];

const { height: SCREEN_H } = Dimensions.get("window");
const PORTRAIT_H = Math.min(Math.round(SCREEN_H * 0.44), 320);

/* ── Stars (filled + unfilled to rarity) ── */
function Stars({ count, color }: { count: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < count ? "star" : "star-outline"}
          size={13}
          color={i < count ? color : COLORS.border}
        />
      ))}
    </View>
  );
}

/* ── Compact scenic background for the portrait area ── */
function HeroPortraitBg({ element, accent }: { element: string; accent: string }) {
  const o = accent;

  if (element === "River") {
    return (
      <>
        {/* Hospital night ward — cool stone, city window, ceiling panels */}
        <LinearGradient colors={["#0a1422", "#0d1828", "#081018"]} style={StyleSheet.absoluteFillObject} />
        {/* Dado stripe */}
        <View style={{ position: "absolute", top: "58%", left: 0, right: 0, height: 1.5, backgroundColor: "#1c2b3a" }} />
        <View style={{ position: "absolute", top: "58%", left: 0, right: 0, height: "8%", backgroundColor: "#070e18" }} />
        {/* Ceiling fluorescent panel */}
        <View style={{ position: "absolute", top: "4%", left: "20%", width: "28%", height: "2%", backgroundColor: "#b8dcee", borderRadius: 2, opacity: 0.75 }} />
        <LinearGradient colors={["#b8dcee20", "#00000000"]} style={{ position: "absolute", top: "6%", left: "12%", width: "42%", height: "18%" }} />
        <View style={{ position: "absolute", top: "4%", right: "18%", width: "18%", height: "2%", backgroundColor: "#b8dcee", borderRadius: 2, opacity: 0.55 }} />
        {/* Window — right back */}
        <View style={{ position: "absolute", right: "4%", top: "10%", width: "22%", height: "46%", borderWidth: 1.5, borderColor: "#1e3040", borderRadius: 2, overflow: "hidden" }}>
          <LinearGradient colors={["#070e1c", "#0a1428"]} style={{ flex: 1 }} />
          {[{t:"12%",l:"20%"},{t:"30%",l:"62%"},{t:"22%",l:"76%"},{t:"50%",l:"30%"},{t:"42%",l:"54%"},{t:"62%",l:"12%"}].map((d, i) => (
            <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any, width: 2, height: 2, borderRadius: 1, backgroundColor: i % 3 === 0 ? "#ffd06080" : i % 3 === 1 ? "#60a5ff80" : "#ffe08080" }} />
          ))}
          <View style={{ position: "absolute", bottom: "28%", left: "6%", width: "22%", height: "22%", backgroundColor: "#05090f" }} />
          <View style={{ position: "absolute", bottom: "28%", right: "10%", width: "24%", height: "30%", backgroundColor: "#05090f" }} />
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%", backgroundColor: "#04080e" }} />
        </View>
        <View style={{ position: "absolute", right: "4%", top: "33%", width: "22%", height: 1, backgroundColor: "#1e3040" }} />
        {/* IV pole */}
        <View style={{ position: "absolute", left: "20%", top: 0, width: 2, height: "72%", backgroundColor: "#243648" }} />
        <View style={{ position: "absolute", left: "17%", top: "4%", width: "6%", height: "10%", borderRadius: 4, backgroundColor: "#122840", borderWidth: 1, borderColor: o + "40" }}>
          <LinearGradient colors={[o + "18", o + "08"]} style={{ flex: 1, borderRadius: 4 }} />
        </View>
        {/* Heart monitor small */}
        <View style={{ position: "absolute", right: "30%", top: "18%", width: "13%", height: "22%", backgroundColor: "#0c1c2c", borderRadius: 3, borderWidth: 1, borderColor: "#1e3048" }}>
          <View style={{ position: "absolute", top: "12%", left: "10%", right: "10%", height: "40%", backgroundColor: "#060e10", borderRadius: 2 }}>
            <View style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, backgroundColor: o + "70" }} />
          </View>
        </View>
        {/* Floor tiles */}
        <LinearGradient colors={["#08101e", "#0c1622"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
        <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff09" }} />
        <View style={{ position: "absolute", bottom: "16%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff07" }} />
      </>
    );
  }

  if (element === "Air") {
    return (
      <>
        {/* Garden pavilion — stone arch, moonlight, bamboo, lanterns */}
        <LinearGradient colors={["#0c1828", "#101e32", "#0a1420"]} style={StyleSheet.absoluteFillObject} />
        {/* Stone rows */}
        {[14, 30, 46, 62].map((t, i) => (
          <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
        ))}
        {/* Tall pointed arch window */}
        <View style={{ position: "absolute", alignSelf: "center", top: "4%", width: "42%", height: "62%", borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: 1.5, borderColor: "#2e4050", overflow: "hidden" }}>
          <LinearGradient colors={["#0e2040", "#0c1830", "#081020"]} style={{ flex: 1 }} />
          <LinearGradient colors={[o + "20", "#00000000"]} style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "55%" }} />
          {/* Moon suggestion */}
          <View style={{ position: "absolute", top: "12%", left: "38%", width: 14, height: 14, borderRadius: 7, backgroundColor: "#e8e0c8", opacity: 0.35 }} />
        </View>
        <LinearGradient colors={[o + "16", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "4%", width: "52%", height: "38%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "66%", width: "48%", height: "2%", backgroundColor: "#162430", borderRadius: 1 }} />
        {/* Bamboo — left */}
        <View style={{ position: "absolute", left: "4%", top: 0, width: 3, height: "70%", backgroundColor: "#1a2e22", borderRadius: 2 }} />
        <View style={{ position: "absolute", left: "9%", top: "5%", width: 2, height: "62%", backgroundColor: "#162818", borderRadius: 2 }} />
        <View style={{ position: "absolute", left: "13%", top: "2%", width: 2.5, height: "56%", backgroundColor: "#1c3020", borderRadius: 2 }} />
        {[12, 26, 42, 56].map((t, i) => (
          <View key={i} style={{ position: "absolute", left: "3%", top: `${t}%`, width: "14%", height: 1.5, backgroundColor: "#223828" }} />
        ))}
        <View style={{ position: "absolute", left: "0%", top: "6%", width: "18%", height: "12%", borderRadius: 999, backgroundColor: "#1e3022", opacity: 0.5 }} />
        {/* Lantern — right */}
        <View style={{ position: "absolute", right: "8%", top: "14%", width: 2, height: "20%", backgroundColor: "#243420" }} />
        <View style={{ position: "absolute", right: "5%", top: "34%", width: "9%", height: "8%", borderRadius: 4, backgroundColor: "#18200e", borderWidth: 1, borderColor: o + "50" }}>
          <LinearGradient colors={[o + "40", o + "10"]} style={{ flex: 1, borderRadius: 4 }} />
        </View>
        <LinearGradient colors={[o + "22", "#00000000"]} style={{ position: "absolute", right: "4%", top: "38%", width: "12%", height: "20%", borderRadius: 999 }} />
        {/* Stone floor */}
        <LinearGradient colors={["#0c1620", "#101a28"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
        <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0A" }} />
        <View style={{ position: "absolute", bottom: "16%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff07" }} />
      </>
    );
  }

  if (element === "Fire") {
    return (
      <>
        {/* Alchemical forge — dark stone, torches, cauldron */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#100c08" }} />
        {[10, 22, 36, 50, 64, 78].map((t, i) => (
          <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff05" }} />
        ))}
        {/* Stone arch piers */}
        <View style={{ position: "absolute", left: "14%", top: 0, width: "5%", height: "28%", backgroundColor: "#0c0906" }} />
        <View style={{ position: "absolute", right: "14%", top: 0, width: "5%", height: "28%", backgroundColor: "#0c0906" }} />
        <View style={{ position: "absolute", alignSelf: "center", top: 0, width: "32%", height: "6%", backgroundColor: "#0c0906", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }} />
        {/* LEFT TORCH */}
        <View style={{ position: "absolute", left: "5%", top: "22%", width: "9%", height: "3%", backgroundColor: "#28180e", borderRadius: 2 }} />
        <View style={{ position: "absolute", left: "8%", top: "12%", width: 3, height: "12%", backgroundColor: "#382618" }} />
        <View style={{ position: "absolute", left: "7%", top: "7%", width: "6%", height: "6%", borderRadius: 999, backgroundColor: o + "95" }} />
        <LinearGradient colors={[o + "60", "#00000000"]} style={{ position: "absolute", left: "2%", top: "5%", width: "14%", height: "28%", borderRadius: 999 }} />
        {/* RIGHT TORCH */}
        <View style={{ position: "absolute", right: "5%", top: "22%", width: "9%", height: "3%", backgroundColor: "#28180e", borderRadius: 2 }} />
        <View style={{ position: "absolute", right: "8%", top: "12%", width: 3, height: "12%", backgroundColor: "#382618" }} />
        <View style={{ position: "absolute", right: "7%", top: "7%", width: "6%", height: "6%", borderRadius: 999, backgroundColor: o + "95" }} />
        <LinearGradient colors={[o + "60", "#00000000"]} style={{ position: "absolute", right: "2%", top: "5%", width: "14%", height: "28%", borderRadius: 999 }} />
        {/* Shelves left */}
        <View style={{ position: "absolute", left: "2%", top: "44%", width: "18%", height: 2, backgroundColor: "#28180e" }} />
        <View style={{ position: "absolute", left: "3%", top: "36%", width: "5%", height: "9%", borderRadius: 3, backgroundColor: "#1a2810", borderWidth: 1, borderColor: o + "45" }} />
        <View style={{ position: "absolute", left: "10%", top: "34%", width: "4%", height: "11%", borderRadius: 999, backgroundColor: "#2a1610", borderWidth: 1, borderColor: "#dc262650" }} />
        {/* CAULDRON */}
        <View style={{ position: "absolute", bottom: "30%", alignSelf: "center", width: "24%", height: "14%", borderRadius: 28, backgroundColor: "#0c0804", borderWidth: 2, borderColor: "#261a0e" }} />
        <View style={{ position: "absolute", bottom: "44%", alignSelf: "center", width: "28%", height: "2.5%", borderRadius: 999, backgroundColor: "#1a1008" }} />
        <LinearGradient colors={[o + "50", "#00000000"]} style={{ position: "absolute", bottom: "46%", alignSelf: "center", width: "20%", height: "18%", borderRadius: 999, opacity: 0.75 }} />
        <LinearGradient colors={[o + "35", o + "10", "#00000000"]} style={{ position: "absolute", bottom: "58%", alignSelf: "center", width: "10%", height: "20%", borderRadius: 999 }} />
        {/* Floor */}
        <LinearGradient colors={["#0a0804", "#0e0c08"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28%" }} />
        <View style={{ position: "absolute", bottom: "24%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      </>
    );
  }

  if (element === "Mind") {
    return (
      <>
        {/* Neural observatory — dark tech dome, holographic rings */}
        <LinearGradient colors={["#06040e", "#0a0818", "#060412"]} style={StyleSheet.absoluteFillObject} />
        {/* Holographic rings */}
        <View style={{ position: "absolute", alignSelf: "center", top: "3%", width: "55%", aspectRatio: 1, borderRadius: 999, borderWidth: 1.5, borderColor: o + "32" }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "12%", width: "37%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderColor: o + "22" }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "21%", width: 9, height: 9, borderRadius: 5, backgroundColor: o + "95" }} />
        {/* Cross hairs inside ring */}
        <View style={{ position: "absolute", alignSelf: "center", top: "26%", left: "23%", right: "23%", height: 0.5, backgroundColor: o + "1a" }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "3%", width: 0.5, height: "24%", backgroundColor: o + "14" }} />
        {/* Wall monitors */}
        <View style={{ position: "absolute", left: "2%", top: "16%", width: "14%", height: "28%", borderWidth: 1, borderColor: o + "24", borderRadius: 2, overflow: "hidden" }}>
          <LinearGradient colors={[o + "0c", "#00000000"]} style={{ flex: 1 }} />
          {[18, 34, 52, 70].map((t, i) => (
            <View key={i} style={{ position: "absolute", top: `${t}%`, left: "10%", right: "10%", height: 0.5, backgroundColor: o + (i % 2 === 0 ? "1e" : "10") }} />
          ))}
        </View>
        <View style={{ position: "absolute", right: "2%", top: "22%", width: "12%", height: "22%", borderWidth: 1, borderColor: o + "20", borderRadius: 2, overflow: "hidden" }}>
          <LinearGradient colors={[o + "08", "#00000000"]} style={{ flex: 1 }} />
          {[22, 44, 66].map((t, i) => (
            <View key={i} style={{ position: "absolute", top: `${t}%`, left: "10%", right: "10%", height: 0.5, backgroundColor: o + "14" }} />
          ))}
        </View>
        {/* Lab bench */}
        <View style={{ position: "absolute", bottom: "28%", left: 0, right: 0, height: "4%", backgroundColor: "#100c1c" }} />
        <View style={{ position: "absolute", bottom: "32%", left: 0, right: 0, height: 1.5, backgroundColor: o + "25" }} />
        {[{ l: "20%", c: o }, { l: "34%", c: "#22c55e" }, { l: "50%", c: "#f97316" }, { l: "65%", c: o }].map((j, i) => (
          <View key={i} style={{ position: "absolute", bottom: "32%", left: j.l as any, width: "7%", height: "11%", borderRadius: 3, backgroundColor: "#0c0a18", borderWidth: 1, borderColor: j.c + "50" }}>
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "36%", borderRadius: 3, backgroundColor: j.c + "20" }} />
          </View>
        ))}
        {/* Floor */}
        <LinearGradient colors={["#04020c", "#080614"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
      </>
    );
  }

  /* Default — Ancient Healing Temple */
  return (
    <>
      <LinearGradient colors={["#0e0c0a", "#120e0a", "#100c08"]} style={StyleSheet.absoluteFillObject} />
      {[10, 24, 40, 56, 70].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff05" }} />
      ))}
      {/* Left pillar */}
      <View style={{ position: "absolute", left: "5%", top: 0, bottom: 0, width: "10%", backgroundColor: "#0a0806" }} />
      <View style={{ position: "absolute", left: "5%", top: 0, bottom: 0, width: 1.5, backgroundColor: o + "22" }} />
      <View style={{ position: "absolute", left: "4%", top: 0, width: "12%", height: "5%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", left: "4%", bottom: "27%", width: "12%", height: "3%", backgroundColor: "#090706" }} />
      {/* Right pillar */}
      <View style={{ position: "absolute", right: "5%", top: 0, bottom: 0, width: "10%", backgroundColor: "#0a0806" }} />
      <View style={{ position: "absolute", right: "5%", top: 0, bottom: 0, width: 1.5, backgroundColor: o + "22" }} />
      <View style={{ position: "absolute", right: "4%", top: 0, width: "12%", height: "5%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", right: "4%", bottom: "27%", width: "12%", height: "3%", backgroundColor: "#090706" }} />
      {/* Pillar lanterns */}
      <View style={{ position: "absolute", left: "8%", top: "22%", width: "5%", height: "9%", borderRadius: 2, backgroundColor: "#18100a", borderWidth: 1, borderColor: o + "55" }}>
        <LinearGradient colors={[o + "45", o + "10"]} style={{ flex: 1, borderRadius: 2 }} />
      </View>
      <LinearGradient colors={[o + "28", "#00000000"]} style={{ position: "absolute", left: "6%", top: "24%", width: "9%", height: "18%", borderRadius: 999 }} />
      <View style={{ position: "absolute", right: "8%", top: "22%", width: "5%", height: "9%", borderRadius: 2, backgroundColor: "#18100a", borderWidth: 1, borderColor: o + "55" }}>
        <LinearGradient colors={[o + "45", o + "10"]} style={{ flex: 1, borderRadius: 2 }} />
      </View>
      <LinearGradient colors={[o + "28", "#00000000"]} style={{ position: "absolute", right: "6%", top: "24%", width: "9%", height: "18%", borderRadius: 999 }} />
      {/* Central arch */}
      <View style={{ position: "absolute", alignSelf: "center", top: "6%", width: "42%", height: "58%", borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: 1.5, borderColor: o + "1e", overflow: "hidden" }}>
        <LinearGradient colors={[o + "12", o + "06", "#00000000"]} style={{ flex: 1 }} />
      </View>
      <LinearGradient colors={[o + "18", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "6%", width: "42%", height: "30%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />
      {/* Altar */}
      <View style={{ position: "absolute", bottom: "30%", alignSelf: "center", width: "36%", height: "3.5%", backgroundColor: "#121008", borderRadius: 3, borderTopWidth: 1, borderColor: o + "38" }} />
      <LinearGradient colors={[o + "28", "#00000000"]} style={{ position: "absolute", bottom: "33%", alignSelf: "center", width: "28%", height: "10%", borderRadius: 999 }} />
      <View style={{ position: "absolute", bottom: "26%", alignSelf: "center", width: "42%", height: "2%", backgroundColor: "#100e08", borderRadius: 2 }} />
      {/* Floor */}
      <LinearGradient colors={["#080604", "#0c0a08"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
      <View style={{ position: "absolute", bottom: "23%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "15%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
    </>
  );
}

export default function HeroProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { player, saveActiveTeam } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("Details");

  const hero = HEROES.find((h) => h.id === id);

  if (!hero || !player) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.onSurface} />
          <Text style={styles.backTxt}>Heroes</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: COLORS.onSurfaceTertiary }}>Hero not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accent    = ELEMENT_COLORS[hero.element] ?? COLORS.brand;
  const portrait  = getHeroSprite(hero.id);
  const isOwned   = player.heroes_owned.includes(hero.id);
  const inTeam    = player.active_team.includes(hero.id);
  const teamSlot  = player.active_team.indexOf(hero.id) + 1;
  const teamFull  = player.active_team.length >= 3;

  const nextRank  = RANKS[player.rank_index + 1];
  const progress  = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) /
        (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;
  const powerScore = hero.rarity * 280 + hero.skills.length * 90;

  const toggleTeam = async () => {
    if (!isOwned) return;
    const cur = player.active_team;
    if (inTeam) {
      if (cur.length <= 1) return;
      await saveActiveTeam(cur.filter((x) => x !== hero.id));
    } else {
      if (teamFull) return;
      await saveActiveTeam([...cur, hero.id]);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── PORTRAIT STAGE — full-width, no margins, scenic bg behind hero ── */}
      <View style={styles.portraitStage}>
        <HeroPortraitBg element={hero.element} accent={accent} />

        {portrait ? (
          <Image
            source={portrait}
            style={styles.portrait}
            contentFit="contain"
            contentPosition="center"
          />
        ) : (
          <View style={styles.portraitFallback} />
        )}

        {/* Gradient fade: portrait melts into surface below */}
        <LinearGradient
          colors={["#00000000", COLORS.surface + "CC", COLORS.surface]}
          locations={[0.5, 0.85, 1]}
          style={styles.portraitFade}
        />

        {/* Back nav — overlaid top-left */}
        <Pressable style={styles.backBtn} onPress={() => router.back()} testID="hero-profile-back">
          <View style={styles.backBubble}>
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </View>
        </Pressable>

        {/* Team badge — overlaid top-right */}
        {inTeam && (
          <View style={[styles.teamBadge, { backgroundColor: accent }]}>
            <Text style={styles.teamBadgeTxt}>SLOT {teamSlot}</Text>
          </View>
        )}
      </View>

      {/* ── IDENTITY BLOCK ── */}
      <View style={styles.identityBlock}>
        <View style={styles.identityRow}>
          <Stars count={hero.rarity} color={accent} />
          <View style={[styles.elementBadge, { borderColor: accent + "80", backgroundColor: accent + "18" }]}>
            <Text style={[styles.elementTxt, { color: accent }]}>{hero.element.toUpperCase()}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleTxt}>{hero.role}</Text>
          </View>
        </View>

        <Text style={styles.heroName}>{hero.name}</Text>
        <Text style={styles.heroTitle}>{hero.title}</Text>

        {/* Power + XP strip */}
        <View style={styles.statRow}>
          <View style={[styles.powerChip, { borderColor: accent + "35" }]}>
            <Text style={[styles.powerLabel, { color: accent }]}>⚡ POWER</Text>
            <Text style={[styles.powerNum, { color: accent }]}>{powerScore.toLocaleString()}</Text>
          </View>
          <View style={styles.xpArea}>
            <View style={styles.xpTopRow}>
              <Text style={styles.xpLabel}>PLAYER XP</Text>
              <Text style={styles.xpNum}>{nextRank ? `${player.xp} / ${nextRank.xpRequired}` : "MAX"}</Text>
            </View>
            <View style={styles.xpBg}>
              <View style={[styles.xpBar, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: accent }]} />
            </View>
          </View>
        </View>

        {/* Team toggle */}
        {isOwned && (
          <Pressable
            style={[styles.teamToggleBtn, {
              backgroundColor: inTeam ? accent + "18" : COLORS.brand + "18",
              borderColor: inTeam ? accent + "70" : COLORS.brand + "70",
            }]}
            onPress={toggleTeam}
            testID="hero-profile-toggle-team"
          >
            <Ionicons
              name={inTeam ? "checkmark-circle" : teamFull ? "close-circle" : "add-circle"}
              size={16}
              color={inTeam ? accent : teamFull ? COLORS.error : COLORS.brand}
            />
            <Text style={[styles.teamToggleTxt, { color: inTeam ? accent : teamFull ? COLORS.error : COLORS.brand }]}>
              {inTeam ? `On Active Team — Slot ${teamSlot}` : teamFull ? "Team Full (3 / 3)" : "Add to Active Team"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── TAB BAR ── */}
      <View style={[styles.tabBar, { borderBottomColor: accent + "28" }]}>
        {TABS.map((tab) => (
          <Pressable key={tab} style={styles.tabBtn} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabTxt, activeTab === tab && { color: accent, fontWeight: "700" }]}>
              {tab}
            </Text>
            {activeTab === tab && (
              <View style={[styles.tabUnderline, { backgroundColor: accent }]} />
            )}
          </Pressable>
        ))}
      </View>

      {/* ── TAB CONTENT ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {activeTab === "Details"  && <DetailsTab  hero={hero} accent={accent} />}
        {activeTab === "Skills"   && <SkillsTab   hero={hero} accent={accent} />}
        {activeTab === "Upgrade"  && <PlaceholderTab label="Upgrade" accent={accent} icon="trending-up-outline"
            message="Hero upgrades unlock at Clinical Guardian rank. Continue earning XP to power up your team." />}
        {activeTab === "Bond"     && <PlaceholderTab label="Bond" accent={accent} icon="heart-outline"
            message="Bond stories deepen as you use this hero in shifts. Build trust to unlock hidden abilities." />}
        {activeTab === "Lore"     && <LoreTab hero={hero} accent={accent} />}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────
   TAB CONTENT COMPONENTS
──────────────────────────────────────── */

function DetailsTab({ hero, accent }: { hero: any; accent: string }) {
  return (
    <View style={{ gap: SPACING.lg }}>
      {hero.quote && (
        <View style={[styles.quoteBlock, { borderLeftColor: accent }]}>
          <Text style={[styles.quoteTxt, { color: accent + "DD" }]}>"{hero.quote}"</Text>
        </View>
      )}
      <View style={styles.detailSection}>
        <SectionHeader title="Overview" icon="information-circle-outline" accent={accent} />
        <Text style={styles.descTxt}>{hero.description}</Text>
      </View>
      {hero.medicalFocus && (
        <View style={styles.detailSection}>
          <SectionHeader title="Medical Focus" icon="medkit-outline" accent={accent} />
          <Text style={[styles.focusBox, { borderLeftColor: accent + "60" }]}>{hero.medicalFocus}</Text>
        </View>
      )}
      {hero.faction && (
        <View style={styles.detailSection}>
          <SectionHeader title="Faction" icon="shield-outline" accent={accent} />
          <Text style={styles.descTxt}>{hero.faction}</Text>
        </View>
      )}
      {hero.bestAgainst && (
        <View style={styles.detailSection}>
          <SectionHeader title="Effective Against" icon="flash-outline" accent={accent} />
          <View style={[styles.counterpickChip, { borderColor: accent + "60", backgroundColor: accent + "10" }]}>
            <Text style={[styles.counterpickTxt, { color: accent }]}>{hero.bestAgainst} element</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function SkillsTab({ hero, accent }: { hero: any; accent: string }) {
  return (
    <View style={{ gap: SPACING.md }}>
      <SectionHeader title="Skills & Abilities" icon="flash-outline" accent={accent} />
      {hero.skills.map((s: any) => (
        <View key={s.id} style={[styles.skillCard, { borderColor: accent + "30" }]}>
          <View style={styles.skillHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.skillName}>{s.name}</Text>
              <Text style={styles.skillType}>{s.type.toUpperCase()}</Text>
            </View>
            <View style={[styles.apChip, { backgroundColor: accent + "20", borderColor: accent + "60" }]}>
              <Text style={[styles.apTxt, { color: accent }]}>{s.cost} AP</Text>
            </View>
          </View>
          <Text style={styles.skillDesc}>{s.description}</Text>
          {s.beginnerExplanation && (
            <View style={styles.explainBox}>
              <Text style={styles.explainLabel}>BEGINNER</Text>
              <Text style={styles.explainTxt}>{s.beginnerExplanation}</Text>
            </View>
          )}
          {s.nclexExplanation && (
            <View style={[styles.explainBox, { backgroundColor: COLORS.brand + "08" }]}>
              <Text style={[styles.explainLabel, { color: COLORS.brand }]}>NCLEX</Text>
              <Text style={styles.explainTxt}>{s.nclexExplanation}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function LoreTab({ hero, accent }: { hero: any; accent: string }) {
  const backstory = hero.backstory ?? `The full story of ${hero.name} is yet to be written. Continue your shifts to unlock their history.`;
  return (
    <View style={{ gap: SPACING.lg }}>
      <SectionHeader title="Lore" icon="book-outline" accent={accent} />
      <Text style={styles.descTxt}>{backstory}</Text>
      <View style={[styles.bondRow, { borderColor: accent + "30", backgroundColor: COLORS.surfaceSecondary }]}>
        <Ionicons name="heart-outline" size={16} color={accent} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[styles.xpLabel, { color: COLORS.onSurfaceSecondary }]}>BOND LEVEL</Text>
            <Text style={[styles.xpNum, { color: accent }]}>0 / 100</Text>
          </View>
          <View style={styles.xpBg}>
            <View style={[styles.xpBar, { width: "0%", backgroundColor: accent }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function PlaceholderTab({ label, accent, icon, message }: { label: string; accent: string; icon: string; message: string }) {
  return (
    <View style={styles.placeholderTab}>
      <Ionicons name={icon as any} size={40} color={accent + "55"} />
      <Text style={[styles.placeholderTitle, { color: accent }]}>{label}</Text>
      <Text style={styles.placeholderMsg}>{message}</Text>
    </View>
  );
}

function SectionHeader({ title, icon, accent }: { title: string; icon: string; accent: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={13} color={accent} />
      <Text style={[styles.sectionTitle, { color: accent }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

/* ────────────────────────────────────────
   STYLES
──────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* Portrait */
  portraitStage: {
    width: "100%",
    height: PORTRAIT_H,
    overflow: "hidden",
    position: "relative",
  },
  portrait: { flex: 1, width: "100%" },
  portraitFallback: { flex: 1, backgroundColor: COLORS.surfaceTertiary },
  portraitFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
  },

  /* Overlaid back nav */
  backBtn: {
    position: "absolute",
    top: SPACING.sm,
    left: SPACING.md,
  },
  backBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(4,6,10,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  backTxt: { color: COLORS.onSurface, fontSize: 15, fontWeight: "500" },

  /* Team badge */
  teamBadge: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  teamBadgeTxt: { color: COLORS.surface, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  /* Identity */
  identityBlock: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  elementBadge: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 },
  elementTxt:   { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  roleBadge:    { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: COLORS.surfaceTertiary },
  roleTxt:      { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: COLORS.onSurfaceSecondary },
  heroName:     { color: COLORS.onSurface, fontSize: 26, fontWeight: "700", letterSpacing: 0.3, marginTop: 2 },
  heroTitle:    { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: -2 },

  /* Stats row */
  statRow: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.sm, alignItems: "center" },
  powerChip: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: SPACING.sm,
    alignItems: "center",
    minWidth: 80,
    gap: 2,
  },
  powerLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 2 },
  powerNum:   { fontSize: 22, fontWeight: "700" },
  xpArea:     { flex: 1, gap: 4 },
  xpTopRow:   { flexDirection: "row", justifyContent: "space-between" },
  xpLabel:    { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  xpNum:      { color: COLORS.onSurfaceSecondary, fontSize: 9 },
  xpBg:       { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  xpBar:      { height: "100%", borderRadius: 2 },

  /* Team toggle */
  teamToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  teamToggleTxt: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },

  /* Tab bar */
  tabBar: {
    flexDirection: "row",
    marginTop: SPACING.md,
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.xs,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: SPACING.sm, position: "relative" },
  tabTxt: { fontSize: 11, color: COLORS.onSurfaceTertiary, letterSpacing: 0.4 },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 6,
    right: 6,
    height: 2,
    borderRadius: 1,
  },

  /* Tab content */
  tabContent: { padding: SPACING.lg, gap: SPACING.sm },

  /* Details */
  quoteBlock: { borderLeftWidth: 2, paddingLeft: SPACING.md },
  quoteTxt:   { fontSize: 13, fontStyle: "italic", lineHeight: 20 },
  detailSection: { gap: SPACING.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  sectionTitle:  { fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  descTxt:  { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  focusBox: {
    color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20,
    borderLeftWidth: 2, paddingLeft: SPACING.sm,
  },
  counterpickChip: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start",
  },
  counterpickTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  /* Skills */
  skillCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, padding: SPACING.md, gap: SPACING.sm,
  },
  skillHeader: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  skillName:   { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  skillType:   { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  apChip: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  apTxt:       { fontSize: 11, fontWeight: "700" },
  skillDesc:   { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  explainBox:  { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm, gap: 3 },
  explainLabel:{ color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  explainTxt:  { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  /* Lore */
  bondRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md,
  },

  /* Placeholder tab */
  placeholderTab: { alignItems: "center", gap: SPACING.md, paddingVertical: SPACING.xxxl },
  placeholderTitle: { fontSize: 18, fontWeight: "700" },
  placeholderMsg: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", lineHeight: 20 },
});
