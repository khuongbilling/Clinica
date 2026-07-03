import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getHeroBattleSprite } from "./HeroBattleSprites";
import { getEnemySprite } from "./EnemySprites";
import { COLORS, ELEMENT_COLORS } from "@/src/theme/colors";
import type { ActionType, ClueCard, ElementSystem, Hero } from "@/src/game/types";

export type BattleFx = { actorId: string; ts: number } | null;

type SystemIconInfo = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string };

const SYSTEM_ICONS: Record<ElementSystem, SystemIconInfo> = {
  Air: { icon: "lungs", label: "Airway / Breathing" },
  River: { icon: "heart-pulse", label: "Heart / Circulation" },
  Fire: { icon: "fire", label: "Infection / Fever" },
  Energy: { icon: "stomach", label: "Glucose / Metabolism" },
  Storm: { icon: "lightning-bolt", label: "Electrolytes / Nerve" },
  Mind: { icon: "brain", label: "Brain / Mental Status" },
  Filter: { icon: "water", label: "Kidney / Fluid Balance" },
  Forge: { icon: "bone", label: "Bone / Injury" },
  Protection: { icon: "shield", label: "Immune / Protection" },
  Growth: { icon: "sprout", label: "Growth / Recovery" },
};

const COUNTER_LABEL: Record<ActionType, string> = {
  scout: "Assess",
  strike: "Targeted Treatment",
  stabilize: "Stabilize",
  shield: "Protect",
  cleanse: "Cleanse",
  command: "Coordinate",
  analyze: "Analyze",
  support: "Support",
};

interface BattleEnemyInfo {
  id: string;
  name: string;
  realWorld: string;
  primarySystem: ElementSystem;
  secondarySystem?: ElementSystem;
  weakSystem?: ElementSystem;
  dangerTrigger: string;
  bestCounters: ActionType[];
  visibleClues: ClueCard[];
}

interface BattlefieldSceneProps {
  enemy: BattleEnemyInfo;
  team: Hero[];
  selectedHeroId: string | null;
  heroActionsUsed: Record<string, boolean>;
  outcome: "ongoing" | "win" | "loss";
  actionFx: BattleFx;
  enemyFxTs: number;
}

export function BattlefieldScene({ enemy, team, selectedHeroId, heroActionsUsed, outcome, actionFx, enemyFxTs }: BattlefieldSceneProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    setInfoOpen(false);
  }, [enemy.id]);

  return (
    <View style={styles.arena} testID="battlefield-scene">
      <LinearGradient
        colors={["#161A1Fdd", "#0C0E12f5"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}
      />
      <View style={styles.groundLine} />

      {infoOpen && (
        <Pressable style={styles.backdrop} onPress={() => setInfoOpen(false)} testID="battlefield-info-backdrop" />
      )}

      <View style={styles.heroSide}>
        {team.map((h) => (
          <HeroUnit
            key={h.id}
            hero={h}
            selected={selectedHeroId === h.id}
            acted={!!heroActionsUsed[h.id]}
            castTs={actionFx?.actorId === h.id ? actionFx.ts : 0}
            teamDefeated={outcome === "loss"}
          />
        ))}
      </View>

      <View style={styles.enemySide}>
        <EnemyUnit
          enemy={enemy}
          hitTs={enemyFxTs}
          purified={outcome === "win"}
          infoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen((v) => !v)}
        />
      </View>
    </View>
  );
}

/* ── Hero battlefield sprite ── */
function HeroUnit({ hero, selected, acted, castTs, teamDefeated }: {
  hero: Hero; selected: boolean; acted: boolean; castTs: number; teamDefeated: boolean;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const cast = useRef(new Animated.Value(0)).current;
  const defeat = useRef(new Animated.Value(0)).current;
  const sprite = getHeroBattleSprite(hero.id);
  const color = ELEMENT_COLORS[hero.element] || COLORS.brand;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    if (!castTs) return;
    cast.setValue(0);
    Animated.sequence([
      Animated.timing(cast, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(cast, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [castTs, cast]);

  useEffect(() => {
    Animated.timing(defeat, { toValue: teamDefeated ? 1 : 0, duration: 500, useNativeDriver: true }).start();
  }, [teamDefeated, defeat]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const castScale = cast.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const castLift = cast.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const defeatOpacity = defeat.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
  const defeatTranslate = defeat.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });

  return (
    <Animated.View
      style={[
        styles.heroUnitWrap,
        { opacity: Animated.multiply(acted ? 0.55 : 1, defeatOpacity) },
      ]}
      testID={`battlefield-hero-${hero.id}`}
    >
      <Animated.View
        style={[
          styles.heroUnitInner,
          {
            transform: [
              { translateY: Animated.add(translateY, Animated.add(castLift, defeatTranslate)) },
              { scale: castScale },
            ],
          },
        ]}
      >
        {selected && !acted && <View style={[styles.heroGlowRing, { borderColor: color }]} />}
        {!!castTs && <View style={[styles.castBurst, { backgroundColor: color + "55", borderColor: color }]} />}
        {sprite ? (
          <Image source={sprite} style={styles.heroSprite} resizeMode="contain" />
        ) : (
          <View style={[styles.heroFallback, { backgroundColor: color + "30", borderColor: color }]}>
            <Text style={{ color, fontWeight: "800", fontSize: 16 }}>{hero.name[0]}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.heroUnitName, selected && !acted && { color }]} numberOfLines={1}>
        {acted ? "Acted" : hero.name.split(" ")[0]}
      </Text>
    </Animated.View>
  );
}

/* ── Enemy battlefield sprite ── */
function EnemyUnit({ enemy, hitTs, purified, infoOpen, onToggleInfo }: {
  enemy: BattleEnemyInfo; hitTs: number; purified: boolean; infoOpen: boolean; onToggleInfo: () => void;
}) {
  const breathe = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const purify = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const sprite = getEnemySprite(enemy.id);
  const color = ELEMENT_COLORS[enemy.primarySystem] || COLORS.error;
  const primaryIcon = SYSTEM_ICONS[enemy.primarySystem];
  const secondaryIcon = enemy.secondarySystem ? SYSTEM_ICONS[enemy.secondarySystem] : null;

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enemy.id, entrance]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  useEffect(() => {
    if (!hitTs) return;
    shake.setValue(0);
    flash.setValue(0);
    burst.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(burst, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(burst, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
    ]).start();
  }, [hitTs, shake, flash, burst]);

  useEffect(() => {
    Animated.timing(purify, { toValue: purified ? 1 : 0, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [purified, purify]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
  const purifyScale = purify.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] });
  const purifyOpacity = purify.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const entranceX = entrance.interpolate({ inputRange: [0, 1], outputRange: [90, 0] });
  const entranceOpacity = entrance;

  return (
    <View style={styles.enemyUnitWrap} testID={`battlefield-enemy-${enemy.id}`}>
      {infoOpen && (
        <View style={[styles.infoPanel, { borderColor: color }]} testID="battlefield-enemy-info">
          <View style={styles.infoHeaderRow}>
            <MaterialCommunityIcons name={primaryIcon.icon} size={14} color={color} />
            <Text style={[styles.infoTitle, { color }]} numberOfLines={1}>{primaryIcon.label}</Text>
          </View>
          <Text style={styles.infoRealWorld} numberOfLines={1}>{enemy.realWorld}</Text>
          {enemy.visibleClues[0] && (
            <Text style={styles.infoClue} numberOfLines={2}>
              <Text style={styles.infoClueLabel}>Clue: </Text>{enemy.visibleClues[0].label}
            </Text>
          )}
          <View style={styles.infoCounterRow}>
            <Text style={styles.infoCounterLabel}>Best response:</Text>
            <Text style={[styles.infoCounterVal, { color }]} numberOfLines={1}>
              {enemy.bestCounters.slice(0, 2).map((c) => COUNTER_LABEL[c]).join(" · ")}
            </Text>
          </View>
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.enemyBurst, { borderColor: color, opacity: burstOpacity, transform: [{ scale: burstScale }] }]}
      />

      <Pressable onPress={onToggleInfo} testID="battlefield-enemy-tap" hitSlop={6}>
        <Animated.View
          style={{
            opacity: entranceOpacity,
            transform: [{ translateX: entranceX }],
          }}
        >
          <View style={styles.systemBadgeRow}>
            <View style={[styles.systemBadge, { borderColor: color, backgroundColor: color + "22" }]}>
              <MaterialCommunityIcons name={primaryIcon.icon} size={13} color={color} />
            </View>
            {secondaryIcon && (
              <View style={[styles.systemBadge, { borderColor: ELEMENT_COLORS[enemy.secondarySystem!], backgroundColor: ELEMENT_COLORS[enemy.secondarySystem!] + "22" }]}>
                <MaterialCommunityIcons name={secondaryIcon.icon} size={13} color={ELEMENT_COLORS[enemy.secondarySystem!]} />
              </View>
            )}
          </View>
          <Animated.View
            style={{
              transform: [{ translateX: shakeX }, { scale: Animated.multiply(scale, purifyScale) }],
              opacity: purifyOpacity,
            }}
          >
            {sprite ? (
              <Image source={sprite} style={styles.enemySprite} resizeMode="contain" />
            ) : (
              <View style={[styles.enemyFallback, { backgroundColor: color + "30", borderColor: color }]}>
                <Text style={{ color, fontWeight: "800", fontSize: 22 }}>{enemy.name[0]}</Text>
              </View>
            )}
            <Animated.View pointerEvents="none" style={[styles.enemyFlash, { opacity: flash }]} />
          </Animated.View>
        </Animated.View>
      </Pressable>
      <Text style={styles.tapHint}>tap for clue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  arena: {
    height: 196,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    overflow: "visible",
  },
  backdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5,
  },
  groundLine: {
    position: "absolute", left: 0, right: 0, bottom: 38, height: 1,
    backgroundColor: COLORS.borderStrong, opacity: 0.5,
  },
  heroSide: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  heroUnitWrap: { alignItems: "center", width: 56 },
  heroUnitInner: { alignItems: "center", justifyContent: "flex-end", width: 56, height: 82 },
  heroSprite: { width: 56, height: 82 },
  heroFallback: { width: 48, height: 64, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  heroGlowRing: {
    position: "absolute", bottom: -3, width: 40, height: 12, borderRadius: 20,
    borderWidth: 2, opacity: 0.9,
  },
  castBurst: {
    position: "absolute", top: -4, width: 62, height: 62, borderRadius: 31, borderWidth: 1.5,
  },
  heroUnitName: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", marginTop: 3 },
  enemySide: { alignItems: "center", justifyContent: "flex-end", zIndex: 6 },
  enemyUnitWrap: { width: 116, minHeight: 130, alignItems: "center", justifyContent: "flex-end" },
  enemySprite: { width: 108, height: 118 },
  enemyFallback: { width: 92, height: 100, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  enemyFlash: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF", borderRadius: 10,
  },
  enemyBurst: {
    position: "absolute", bottom: 4, width: 84, height: 84, borderRadius: 42, borderWidth: 2,
  },
  systemBadgeRow: {
    position: "absolute", top: -6, right: -4, zIndex: 3, flexDirection: "row", gap: 3,
  },
  systemBadge: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  tapHint: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "600", marginTop: 3, opacity: 0.8 },
  infoPanel: {
    position: "absolute", bottom: 132, right: -6, width: 180, zIndex: 10,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1.5, borderRadius: 8,
    padding: 8, gap: 3,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  infoHeaderRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoTitle: { fontSize: 11, fontWeight: "800" },
  infoRealWorld: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontStyle: "italic" },
  infoClue: { color: COLORS.onSurface, fontSize: 10, lineHeight: 13 },
  infoClueLabel: { color: COLORS.onSurfaceTertiary, fontWeight: "700" },
  infoCounterRow: { marginTop: 2, gap: 1 },
  infoCounterLabel: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  infoCounterVal: { fontSize: 10, fontWeight: "700" },
});
