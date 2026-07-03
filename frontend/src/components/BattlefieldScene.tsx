import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { getHeroBattleSprite } from "./HeroBattleSprites";
import { getEnemySprite } from "./EnemySprites";
import { COLORS, ELEMENT_COLORS } from "@/src/theme/colors";
import type { Hero } from "@/src/game/types";

export type BattleFx = { actorId: string; ts: number } | null;

interface BattlefieldSceneProps {
  enemy: { id: string; name: string; primarySystem: string };
  team: Hero[];
  selectedHeroId: string | null;
  heroActionsUsed: Record<string, boolean>;
  outcome: "ongoing" | "win" | "loss";
  actionFx: BattleFx;
  enemyFxTs: number;
}

export function BattlefieldScene({ enemy, team, selectedHeroId, heroActionsUsed, outcome, actionFx, enemyFxTs }: BattlefieldSceneProps) {
  return (
    <View style={styles.arena} testID="battlefield-scene">
      <LinearGradient
        colors={["#161A1Fdd", "#0C0E12f5"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}
      />
      <View style={styles.groundLine} />

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
        <EnemyUnit enemy={enemy} hitTs={enemyFxTs} purified={outcome === "win"} />
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

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const castScale = cast.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const castLift = cast.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const defeatOpacity = defeat.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
  const defeatTranslate = defeat.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });

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
function EnemyUnit({ enemy, hitTs, purified }: { enemy: { id: string; name: string; primarySystem: string }; hitTs: number; purified: boolean }) {
  const breathe = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const purify = useRef(new Animated.Value(0)).current;
  const sprite = getEnemySprite(enemy.id);
  const color = ELEMENT_COLORS[enemy.primarySystem] || COLORS.error;

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

  return (
    <View style={styles.enemyUnitWrap} testID={`battlefield-enemy-${enemy.id}`}>
      <Animated.View
        pointerEvents="none"
        style={[styles.enemyBurst, { borderColor: color, opacity: burstOpacity, transform: [{ scale: burstScale }] }]}
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  arena: {
    height: 132,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    overflow: "hidden",
  },
  groundLine: {
    position: "absolute", left: 0, right: 0, bottom: 26, height: 1,
    backgroundColor: COLORS.borderStrong, opacity: 0.5,
  },
  heroSide: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  heroUnitWrap: { alignItems: "center", width: 46 },
  heroUnitInner: { alignItems: "center", justifyContent: "flex-end", width: 46, height: 64 },
  heroSprite: { width: 46, height: 64 },
  heroFallback: { width: 40, height: 52, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  heroGlowRing: {
    position: "absolute", bottom: -3, width: 34, height: 10, borderRadius: 20,
    borderWidth: 2, opacity: 0.9,
  },
  castBurst: {
    position: "absolute", top: -4, width: 52, height: 52, borderRadius: 26, borderWidth: 1.5,
  },
  heroUnitName: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "700", marginTop: 2 },
  enemySide: { alignItems: "center", justifyContent: "flex-end" },
  enemyUnitWrap: { width: 92, height: 100, alignItems: "center", justifyContent: "flex-end" },
  enemySprite: { width: 88, height: 96 },
  enemyFallback: { width: 76, height: 84, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  enemyFlash: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF", borderRadius: 10,
  },
  enemyBurst: {
    position: "absolute", bottom: 4, width: 70, height: 70, borderRadius: 35, borderWidth: 2,
  },
});
