/**
 * IdentityReconstructionScreen — Push 8
 *
 * Lotus Recall character-creation screen for the
 * `identity_reconstruction_character_creation` prologue phase.
 *
 * Flow:  intro (7 beats + title) → naming → appearance → pathway (3 Qs)
 *        → aptitude confirm → summary confirm → closing animation → onComplete()
 *
 * All choices are persisted via confirmIdentityReconstruction in the store
 * before onComplete() is called.  An AsyncStorage draft survives mid-session
 * app closes so the player never loses progress.
 *
 * Art style: donghua / Genshin-Impact cel-shading luminous.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

import { usePlayer, type IdentityReconstructionInput } from "@/src/game/store";
import type { Aptitude } from "@/src/game/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const DRAFT_KEY = "clinica.identity_creation_draft";
const { width: W, height: H } = Dimensions.get("window");

const INTRO_BEATS = [
  { text: "Your strength has been taken from you.",        sub: null },
  { text: "Your title has been forgotten.",                sub: null },
  { text: "Your achievements belong to a life that has already ended.", sub: null },
  { text: "Yet something remains.",                        sub: null },
  { text: "A will to heal.",                               sub: null },
  { text: "A desire to understand.",                       sub: null },
  { text: "And one final opportunity to begin again.",     sub: null },
  { text: "Who will you become this time?",                sub: "IDENTITY RECONSTRUCTION", isTitle: true },
];

const SKIN_TONES = [
  "#FDCFA0", // ivory
  "#F0BC8A", // warm peach
  "#DFA06E", // honey
  "#C07845", // caramel
  "#8A5230", // mahogany
  "#4E2C18", // deep walnut
];

const HAIR_COLORS = [
  "#F8E8C8", // platinum / white
  "#E8C878", // golden
  "#5A3A1A", // dark brown
  "#1A1A2A", // black-blue
  "#B83838", // crimson
];

const HAIR_STYLE_LABELS = ["Cropped", "Short", "Shoulder", "Long", "Updo"];

const PRONOUN_OPTIONS = ["she / her", "he / him", "they / them", "any / all"];

type AptitudeKey = "guardian" | "sage" | "warden" | "weaver";

const APTITUDE_DATA: Record<AptitudeKey, {
  name: string; symbol: string; color: string; glow: string;
  trait: string; desc: string;
}> = {
  guardian: {
    name: "Ward Guardian",
    symbol: "◈",
    color: "#5A9FE8",
    glow: "rgba(90,159,232,0.28)",
    trait: "Protector · Shield Bearer",
    desc: "You stand between harm and those in your care. Unshakeable under pressure.",
  },
  sage: {
    name: "Clinical Sage",
    symbol: "◆",
    color: "#A87DE0",
    glow: "rgba(168,125,224,0.28)",
    trait: "Analyst · Knowledge Keeper",
    desc: "You find clarity where others see only confusion. Understanding is your sharpest tool.",
  },
  warden: {
    name: "Domain Warden",
    symbol: "✦",
    color: "#3ECFB2",
    glow: "rgba(62,207,178,0.28)",
    trait: "Investigator · Pattern Seeker",
    desc: "Nothing escapes your notice. Every sign holds meaning in your hands.",
  },
  weaver: {
    name: "Harmony Weaver",
    symbol: "✿",
    color: "#E8C453",
    glow: "rgba(232,196,83,0.28)",
    trait: "Connector · Balance Keeper",
    desc: "You read people before you enter the room. Your presence steadies the team.",
  },
};

const PATHWAY_QUESTIONS = [
  {
    id: "q1",
    question: "In a crisis, your first instinct is to:",
    options: [
      { text: "Step forward and protect those around you",    aptitude: "guardian" as AptitudeKey },
      { text: "Gather information before taking action",      aptitude: "sage"     as AptitudeKey },
      { text: "Look for what others might have missed",       aptitude: "warden"   as AptitudeKey },
      { text: "Connect and coordinate those nearby",          aptitude: "weaver"   as AptitudeKey },
    ],
  },
  {
    id: "q2",
    question: "What role do you naturally take in a team?",
    options: [
      { text: "The one who stands between threats and people", aptitude: "guardian" as AptitudeKey },
      { text: "The one who analyzes and advises",              aptitude: "sage"     as AptitudeKey },
      { text: "The one who notices what others missed",        aptitude: "warden"   as AptitudeKey },
      { text: "The one who reads the room and adapts",         aptitude: "weaver"   as AptitudeKey },
    ],
  },
  {
    id: "q3",
    question: "When something goes wrong, you:",
    options: [
      { text: "Act immediately to stop further harm",          aptitude: "guardian" as AptitudeKey },
      { text: "Trace back to find the root cause",             aptitude: "sage"     as AptitudeKey },
      { text: "Question whether this was preventable",         aptitude: "warden"   as AptitudeKey },
      { text: "Check on the people affected first",            aptitude: "weaver"   as AptitudeKey },
    ],
  },
];

type Phase =
  | "intro"
  | "naming"
  | "appearance"
  | "pathway"
  | "aptitude"
  | "confirm"
  | "closing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRecommendation(answers: AptitudeKey[]): AptitudeKey {
  const counts: Record<AptitudeKey, number> = {
    guardian: 0, sage: 0, warden: 0, weaver: 0,
  };
  for (const a of answers) counts[a]++;
  const order: AptitudeKey[] = ["warden", "sage", "guardian", "weaver"];
  return (Object.entries(counts) as [AptitudeKey, number][])
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))[0][0];
}

// ─── Silhouette ──────────────────────────────────────────────────────────────

function Silhouette({
  skinTone, hairStyle, hairColor, aptitude, pulse,
}: {
  skinTone:  number | null;
  hairStyle: number | null;
  hairColor: number | null;
  aptitude:  AptitudeKey | null;
  pulse:     Animated.Value;
}) {
  const bodyColor  = skinTone  !== null ? SKIN_TONES[skinTone]  : "#3A4455";
  const hColor     = hairColor !== null ? HAIR_COLORS[hairColor] : "#2A3040";
  const auraColor  = aptitude  !== null ? APTITUDE_DATA[aptitude].color : "transparent";
  const auraGlow   = aptitude  !== null ? APTITUDE_DATA[aptitude].glow  : "transparent";

  const hairViews: Record<number, React.ReactElement> = {
    0: <View style={[s.silHairBase, { width: 56, height: 16, borderRadius: 8, top: -8, backgroundColor: hColor }]} />,
    1: <View style={[s.silHairBase, { width: 64, height: 26, borderRadius: 14, top: -14, backgroundColor: hColor }]} />,
    2: <View style={[s.silHairBase, { width: 76, height: 38, borderRadius: 12, top: -16, backgroundColor: hColor }]} />,
    3: <View style={[s.silHairBase, { width: 68, height: 60, borderRadius: 16, top: -18, backgroundColor: hColor }]} />,
    4: <View style={[s.silHairBase, { width: 44, height: 44, borderRadius: 22, top: -36, backgroundColor: hColor }]} />,
  };

  return (
    <Animated.View style={[s.silContainer, { transform: [{ scale: pulse }] }]}>
      {aptitude !== null && (
        <>
          <View style={[s.silAuraOuter, { borderColor: auraColor }]} />
          <View style={[s.silAuraInner, { backgroundColor: auraGlow }]} />
        </>
      )}
      <View style={s.silFigure}>
        {hairStyle !== null && hairViews[hairStyle]}
        <View style={[s.silHead, { backgroundColor: bodyColor }]} />
        <View style={[s.silNeck, { backgroundColor: bodyColor }]} />
        <View style={[s.silBody, { backgroundColor: bodyColor }]}>
          <Text style={s.silCross}>✚</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function IdentityReconstructionScreen({ onComplete }: Props) {
  const { confirmIdentityReconstruction } = usePlayer();

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,    setPhase]    = useState<Phase>("intro");
  const [beatIdx,  setBeatIdx]  = useState(0);
  const [name,     setName]     = useState("");
  const [pronouns, setPronouns] = useState("");
  const [skinTone,   setSkinTone]   = useState<number | null>(null);
  const [hairStyle,  setHairStyle]  = useState<number | null>(null);
  const [hairColor,  setHairColor]  = useState<number | null>(null);
  const [qIdx,     setQIdx]     = useState(0);
  const [qAnswers, setQAnswers] = useState<AptitudeKey[]>([]);
  const [recommended, setRecommended] = useState<AptitudeKey>("warden");
  const [chosen,   setChosen]   = useState<AptitudeKey | null>(null);
  const [saving,   setSaving]   = useState(false);

  // ── Animations ────────────────────────────────────────────────────────────
  const beatFade   = useRef(new Animated.Value(1)).current;
  const formFade   = useRef(new Animated.Value(0)).current;
  const shimmer    = useRef(new Animated.Value(0)).current;
  const silPulse   = useRef(new Animated.Value(1)).current;
  const closeFade  = useRef(new Animated.Value(0)).current;
  const qFade      = useRef(new Animated.Value(1)).current;

  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Mount / Unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Water shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 3200, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 3200, useNativeDriver: false }),
      ])
    ).start();

    // Load draft
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw || !mountedRef.current) return;
      try {
        const d = JSON.parse(raw);
        if (d.name)      setName(d.name);
        if (d.pronouns)  setPronouns(d.pronouns);
        if (d.skinTone  != null) setSkinTone(d.skinTone);
        if (d.hairStyle != null) setHairStyle(d.hairStyle);
        if (d.hairColor != null) setHairColor(d.hairColor);
        if (d.chosen)    setChosen(d.chosen as AptitudeKey);
        if (d.phase && !["intro", "closing"].includes(d.phase)) {
          setPhase(d.phase as Phase);
          formFade.setValue(1);
        }
      } catch { /* silent */ }
    });

    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Draft auto-save ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "intro" || phase === "closing") return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
      phase, name, pronouns, skinTone, hairStyle, hairColor, chosen,
    })).catch(() => {});
  }, [phase, name, pronouns, skinTone, hairStyle, hairColor, chosen]);

  // ── Phase transition helpers ──────────────────────────────────────────────
  const goToPhase = useCallback((next: Phase) => {
    Animated.timing(formFade, {
      toValue: 0, duration: 220, useNativeDriver: false,
    }).start(() => {
      if (!mountedRef.current) return;
      setPhase(next);
      Animated.timing(formFade, {
        toValue: 1, duration: 280, useNativeDriver: false,
      }).start();
    });
  }, [formFade]);

  const pulseSilhouette = useCallback(() => {
    Animated.sequence([
      Animated.timing(silPulse, { toValue: 1.08, duration: 150, useNativeDriver: false }),
      Animated.timing(silPulse, { toValue: 1.00, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [silPulse]);

  // ── Intro beat handling ───────────────────────────────────────────────────
  const handleIntroBeat = useCallback(() => {
    const next = beatIdx + 1;
    if (next >= INTRO_BEATS.length) {
      // Transition to naming
      Animated.timing(beatFade, { toValue: 0, duration: 400, useNativeDriver: false }).start(() => {
        if (!mountedRef.current) return;
        setPhase("naming");
        formFade.setValue(0);
        Animated.timing(formFade, { toValue: 1, duration: 400, useNativeDriver: false }).start();
      });
      return;
    }
    Animated.sequence([
      Animated.timing(beatFade, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(beatFade, { toValue: 1, duration: 300, useNativeDriver: false }),
    ]).start(() => {
      if (mountedRef.current) setBeatIdx(next);
    });
  }, [beatIdx, beatFade, formFade]);

  // ── Pathway question answer ───────────────────────────────────────────────
  const handleQAnswer = useCallback((aptitude: AptitudeKey) => {
    const newAnswers = [...qAnswers, aptitude];
    setQAnswers(newAnswers);

    if (newAnswers.length >= PATHWAY_QUESTIONS.length) {
      // All 3 answered — compute recommendation, go to aptitude
      const rec = computeRecommendation(newAnswers);
      setRecommended(rec);
      setChosen(rec);
      Animated.timing(qFade, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
        if (!mountedRef.current) return;
        goToPhase("aptitude");
      });
    } else {
      // Next question
      Animated.sequence([
        Animated.timing(qFade, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(qFade, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start(() => {
        if (mountedRef.current) setQIdx(newAnswers.length);
      });
    }
  }, [qAnswers, goToPhase, qFade]);

  // ── Confirm & close ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    const data: IdentityReconstructionInput = {
      name:                 (name.trim() || "Healer").slice(0, 24),
      pronouns:             pronouns,
      skinTone:             skinTone  ?? 0,
      hairStyle:            hairStyle ?? 0,
      aptitude:             (chosen   ?? "warden") as Aptitude,
      recommendedAptitude:  recommended            as Aptitude,
    };

    try {
      await confirmIdentityReconstruction(data);
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch { /* non-fatal */ }

    // Closing animation
    setPhase("closing");
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(closeFade, { toValue: 1, duration: 1200, useNativeDriver: false }),
    ]).start(() => {
      const t = setTimeout(() => {
        if (mountedRef.current) onComplete();
      }, 400);
      timers.current.push(t);
    });
  }, [
    saving, name, pronouns, skinTone, hairStyle, chosen, recommended,
    confirmIdentityReconstruction, closeFade, onComplete,
  ]);

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1], outputRange: [0.25, 0.55],
  });

  // ── Shared silhouette used in form phases ─────────────────────────────────
  const sharedSilhouette = (
    <Silhouette
      skinTone={skinTone}
      hairStyle={hairStyle}
      hairColor={hairColor}
      aptitude={chosen}
      pulse={silPulse}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // 1 ── INTRO ───────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const beat = INTRO_BEATS[beatIdx];
    return (
      <Pressable style={s.root} onPress={handleIntroBeat}>
        <LinearGradient
          colors={["#0A0518", "#060E14"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Ambient medical symbols */}
        {["✚", "◈", "✦", "◆"].map((sym, i) => (
          <Text
            key={i}
            style={[s.ambientSym, {
              top:  ["18%", "65%", "30%", "75%"][i] as any,
              left: ["8%",  "75%", "82%", "12%"][i] as any,
              color: ["#2A4060", "#2A3050", "#1A3828", "#302818"][i],
            }]}
          >
            {sym}
          </Text>
        ))}
        {/* Water shimmer */}
        <Animated.View style={[s.shimmerContainer, { opacity: shimmerOpacity }]}>
          <LinearGradient
            colors={["transparent", "rgba(62,100,160,0.15)", "rgba(20,40,80,0.30)"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>
        {/* Beat text */}
        <Animated.View style={[s.introBeat, { opacity: beatFade }]}>
          {beat.sub && (
            <Text style={s.introKicker}>{beat.sub}</Text>
          )}
          <Text style={[s.introText, beat.isTitle && s.introTextTitle]}>
            {beat.text}
          </Text>
          {beatIdx < INTRO_BEATS.length - 1 && (
            <Text style={s.introTap}>TAP TO CONTINUE</Text>
          )}
          {beatIdx === INTRO_BEATS.length - 1 && (
            <Text style={s.introTap}>TAP TO BEGIN</Text>
          )}
        </Animated.View>
        {/* Lotus petal accents */}
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[s.petal, {
              top:  [H * 0.12, H * 0.78, H * 0.22, H * 0.68][i],
              left: [W * 0.08, W * 0.82, W * 0.80, W * 0.05][i],
              transform: [{ rotate: ["20deg", "140deg", "280deg", "350deg"][i] as any }],
            }]}
          />
        ))}
      </Pressable>
    );
  }

  // 2 ── CLOSING ─────────────────────────────────────────────────────────────
  if (phase === "closing") {
    return (
      <View style={s.root}>
        <LinearGradient
          colors={["#0A0518", "#060E14"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.closingCenter}>
          {sharedSilhouette}
          <Text style={s.closingText}>Identity Anchored.</Text>
        </View>
        <Animated.View
          style={[StyleSheet.absoluteFill, s.closingOverlay, { opacity: closeFade }]}
          pointerEvents="none"
        />
      </View>
    );
  }

  // 3 ── FORM PHASES ─────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#0A0518", "#060E14"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[s.shimmerContainer, { opacity: shimmerOpacity }]}>
        <LinearGradient
          colors={["transparent", "rgba(62,100,160,0.12)", "rgba(20,40,80,0.25)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header kicker */}
          <View style={s.formHeader}>
            <Text style={s.formKicker}>IDENTITY RECONSTRUCTION</Text>
            <View style={s.formProgressRow}>
              {(["naming", "appearance", "pathway", "aptitude", "confirm"] as Phase[]).map((ph, i) => (
                <View
                  key={ph}
                  style={[
                    s.formPip,
                    (["naming", "appearance", "pathway", "aptitude", "confirm"] as Phase[])
                      .indexOf(phase) >= i
                      ? { backgroundColor: "#E0AAFF" }
                      : { backgroundColor: "rgba(255,255,255,0.10)" },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Silhouette panel */}
          <Animated.View style={[s.silPanel, { opacity: formFade }]}>
            {sharedSilhouette}
          </Animated.View>

          {/* Form content */}
          <Animated.View style={[s.formPanel, { opacity: formFade }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.formScrollContent}
            >
              {/* ─── NAMING ─────────────────────────────────────────────── */}
              {phase === "naming" && (
                <View style={s.formSection}>
                  <Text style={s.formSectionTitle}>Your Name</Text>
                  <Text style={s.formSectionHint}>
                    What shall you be called in this life?
                  </Text>
                  <TextInput
                    style={s.nameInput}
                    placeholder="Enter your name…"
                    placeholderTextColor="#3A4A5A"
                    value={name}
                    onChangeText={setName}
                    maxLength={24}
                    autoFocus
                    returnKeyType="done"
                  />
                  <Text style={s.formSectionTitle}>Pronouns</Text>
                  <Text style={s.formSectionHint}>Optional — skip if you prefer.</Text>
                  <View style={s.pronounRow}>
                    {PRONOUN_OPTIONS.map((p) => (
                      <Pressable
                        key={p}
                        style={({ pressed }) => [
                          s.pronounBtn,
                          pronouns === p && s.pronounBtnActive,
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={() => setPronouns(pronouns === p ? "" : p)}
                      >
                        <Text style={[
                          s.pronounBtnText,
                          pronouns === p && s.pronounBtnTextActive,
                        ]}>
                          {p}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    style={({ pressed }) => [s.nextBtn, pressed && { opacity: 0.82 }]}
                    onPress={() => goToPhase("appearance")}
                  >
                    <Text style={s.nextBtnText}>CONTINUE</Text>
                  </Pressable>
                </View>
              )}

              {/* ─── APPEARANCE ─────────────────────────────────────────── */}
              {phase === "appearance" && (
                <View style={s.formSection}>
                  <Text style={s.formSectionTitle}>Skin Tone</Text>
                  <Text style={s.formSectionHint}>
                    Choose the complexion you carry into this life.
                  </Text>
                  <View style={s.swatchRow}>
                    {SKIN_TONES.map((color, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          s.swatch,
                          { backgroundColor: color },
                          skinTone === i && s.swatchActive,
                          pressed && { opacity: 0.80 },
                        ]}
                        onPress={() => {
                          setSkinTone(i);
                          pulseSilhouette();
                        }}
                      />
                    ))}
                  </View>
                  <Text style={[s.formSectionTitle, { marginTop: 20 }]}>Hair Style</Text>
                  <View style={s.hairStyleRow}>
                    {HAIR_STYLE_LABELS.map((label, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          s.hairStyleBtn,
                          hairStyle === i && s.hairStyleBtnActive,
                          pressed && { opacity: 0.78 },
                        ]}
                        onPress={() => {
                          setHairStyle(i);
                          pulseSilhouette();
                        }}
                      >
                        <Text style={[
                          s.hairStyleBtnText,
                          hairStyle === i && s.hairStyleBtnTextActive,
                        ]}>
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[s.formSectionTitle, { marginTop: 20 }]}>Hair Color</Text>
                  <View style={s.swatchRow}>
                    {HAIR_COLORS.map((color, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          s.swatch,
                          { backgroundColor: color },
                          hairColor === i && s.swatchActive,
                          pressed && { opacity: 0.80 },
                        ]}
                        onPress={() => {
                          setHairColor(i);
                          pulseSilhouette();
                        }}
                      />
                    ))}
                  </View>
                  <Pressable
                    style={({ pressed }) => [s.nextBtn, pressed && { opacity: 0.82 }]}
                    onPress={() => {
                      if (skinTone === null) setSkinTone(2);
                      if (hairStyle === null) setHairStyle(1);
                      if (hairColor === null) setHairColor(2);
                      goToPhase("pathway");
                    }}
                  >
                    <Text style={s.nextBtnText}>CONTINUE</Text>
                  </Pressable>
                </View>
              )}

              {/* ─── PATHWAY (3 questions) ───────────────────────────────── */}
              {phase === "pathway" && (
                <Animated.View style={[s.formSection, { opacity: qFade }]}>
                  <Text style={s.formSectionTitle}>
                    Question {qIdx + 1} of {PATHWAY_QUESTIONS.length}
                  </Text>
                  <Text style={s.pathwayQuestion}>
                    {PATHWAY_QUESTIONS[qIdx].question}
                  </Text>
                  <View style={s.pathwayOptions}>
                    {PATHWAY_QUESTIONS[qIdx].options.map((opt) => (
                      <Pressable
                        key={opt.text}
                        style={({ pressed }) => [
                          s.pathwayOption,
                          pressed && { opacity: 0.80, transform: [{ scale: 0.98 }] },
                        ]}
                        onPress={() => handleQAnswer(opt.aptitude)}
                      >
                        <Text style={s.pathwayOptionText}>{opt.text}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* ─── APTITUDE SELECTION ──────────────────────────────────── */}
              {phase === "aptitude" && (
                <View style={s.formSection}>
                  <Text style={s.formSectionTitle}>Your Calling</Text>
                  <Text style={s.formSectionHint}>
                    The System has identified your natural resonance.
                    {"\n"}You may choose any path.
                  </Text>
                  <View style={s.aptitudeGrid}>
                    {(Object.entries(APTITUDE_DATA) as [AptitudeKey, typeof APTITUDE_DATA[AptitudeKey]][]).map(
                      ([key, info]) => {
                        const isChosen = chosen === key;
                        const isRec    = recommended === key;
                        return (
                          <Pressable
                            key={key}
                            style={({ pressed }) => [
                              s.aptitudeCard,
                              { borderColor: isChosen ? info.color : "rgba(255,255,255,0.10)" },
                              isChosen && { backgroundColor: info.glow },
                              pressed && { opacity: 0.82 },
                            ]}
                            onPress={() => {
                              setChosen(key);
                              pulseSilhouette();
                            }}
                          >
                            {isRec && (
                              <View style={[s.recBadge, { backgroundColor: info.color }]}>
                                <Text style={s.recBadgeText}>RECOMMENDED</Text>
                              </View>
                            )}
                            <Text style={[s.aptitudeSymbol, { color: info.color }]}>
                              {info.symbol}
                            </Text>
                            <Text style={s.aptitudeName}>{info.name}</Text>
                            <Text style={[s.aptitudeTrait, { color: info.color }]}>
                              {info.trait}
                            </Text>
                            <Text style={s.aptitudeDesc}>{info.desc}</Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      s.nextBtn,
                      !chosen && s.nextBtnDisabled,
                      pressed && { opacity: 0.82 },
                    ]}
                    onPress={() => chosen && goToPhase("confirm")}
                    disabled={!chosen}
                  >
                    <Text style={s.nextBtnText}>CONFIRM CALLING</Text>
                  </Pressable>
                </View>
              )}

              {/* ─── CONFIRM SUMMARY ─────────────────────────────────────── */}
              {phase === "confirm" && chosen && (
                <View style={s.formSection}>
                  <Text style={s.formSectionTitle}>Identity Summary</Text>
                  <Text style={s.formSectionHint}>
                    Review your choices before anchoring your identity.
                  </Text>
                  <View style={[s.summaryCard, { borderColor: APTITUDE_DATA[chosen].color + "55" }]}>
                    <SummaryRow
                      label="Name"
                      value={(name.trim() || "Healer").slice(0, 24)}
                      color={APTITUDE_DATA[chosen].color}
                    />
                    {pronouns ? (
                      <SummaryRow
                        label="Pronouns"
                        value={pronouns}
                        color={APTITUDE_DATA[chosen].color}
                      />
                    ) : null}
                    <SummaryRow
                      label="Appearance"
                      value={[
                        HAIR_STYLE_LABELS[hairStyle ?? 1],
                        "hair",
                        "·",
                        skinTone != null ? `Tone ${skinTone + 1}` : "Custom",
                      ].join(" ")}
                      color={APTITUDE_DATA[chosen].color}
                    />
                    <View style={s.summaryDivider} />
                    <View style={s.summaryAptRow}>
                      <Text style={[s.summaryAptSymbol, { color: APTITUDE_DATA[chosen].color }]}>
                        {APTITUDE_DATA[chosen].symbol}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.summaryAptName}>{APTITUDE_DATA[chosen].name}</Text>
                        <Text style={[s.summaryAptTrait, { color: APTITUDE_DATA[chosen].color }]}>
                          {APTITUDE_DATA[chosen].trait}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      s.nextBtn,
                      saving && s.nextBtnDisabled,
                      { backgroundColor: APTITUDE_DATA[chosen].color },
                      pressed && { opacity: 0.82 },
                    ]}
                    onPress={handleConfirm}
                    disabled={saving}
                  >
                    <Text style={[s.nextBtnText, { color: "#060E14" }]}>
                      {saving ? "ANCHORING…" : "CONFIRM IDENTITY"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={s.backLink}
                    onPress={() => goToPhase("aptitude")}
                  >
                    <Text style={s.backLinkText}>← Change Calling</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function SummaryRow({
  label, value, color,
}: {
  label: string; value: string; color: string;
}) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#060E14" },

  // ── Ambient ──
  ambientSym: {
    position: "absolute",
    fontSize: 32,
    opacity: 0.5,
  },
  shimmerContainer: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: H * 0.42,
    pointerEvents: "none" as any,
  },
  petal: {
    position: "absolute",
    width: 18,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(224,170,255,0.10)",
  },

  // ── Intro ──
  introBeat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 20,
  },
  introKicker: {
    color: "#E0AAFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3.5,
  },
  introText: {
    color: "#D0DCF4",
    fontSize: 22,
    fontWeight: "300",
    textAlign: "center",
    lineHeight: 34,
    letterSpacing: 0.4,
  },
  introTextTitle: {
    fontSize: 28,
    fontWeight: "300",
    color: "#EEF2FF",
  },
  introTap: {
    color: "rgba(160,180,210,0.40)",
    fontSize: 10,
    letterSpacing: 3,
    marginTop: 16,
  },

  // ── Silhouette ──
  silContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 200,
  },
  silAuraOuter: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    top: 12,
  },
  silAuraInner: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    top: 20,
  },
  silFigure: {
    alignItems: "center",
    gap: 0,
    position: "relative",
  },
  silHairBase: {
    position: "absolute",
    zIndex: 2,
    alignSelf: "center",
  },
  silHead: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#3A4455",
    marginBottom: 2,
    zIndex: 1,
  },
  silNeck: {
    width: 20,
    height: 12,
    backgroundColor: "#3A4455",
    marginBottom: -4,
    zIndex: 1,
  },
  silBody: {
    width: 72,
    height: 108,
    borderRadius: 14,
    backgroundColor: "#3A4455",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  silCross: {
    color: "rgba(255,255,255,0.12)",
    fontSize: 22,
    fontWeight: "600",
  },

  // ── Form shell ──
  formHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
    gap: 8,
  },
  formKicker: {
    color: "#E0AAFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
  },
  formProgressRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  formPip: {
    height: 3,
    width: 40,
    borderRadius: 2,
  },
  silPanel: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  formPanel: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  formSection: {
    gap: 12,
  },
  formSectionTitle: {
    color: "#C8D8F0",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  formSectionHint: {
    color: "#5A6A80",
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Name input ──
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(224,170,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#EEF2FF",
    fontSize: 17,
    letterSpacing: 0.3,
    marginBottom: 8,
  },

  // ── Pronouns ──
  pronounRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  pronounBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pronounBtnActive: {
    borderColor: "#E0AAFF",
    backgroundColor: "rgba(224,170,255,0.12)",
  },
  pronounBtnText:       { color: "#5A6A80", fontSize: 13 },
  pronounBtnTextActive: { color: "#E0AAFF", fontWeight: "700" },

  // ── Swatches ──
  swatchRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: {
    borderColor: "#E0AAFF",
    transform: [{ scale: 1.15 }],
  },

  // ── Hair style buttons ──
  hairStyleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hairStyleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  hairStyleBtnActive: {
    borderColor: "#E0AAFF",
    backgroundColor: "rgba(224,170,255,0.12)",
  },
  hairStyleBtnText:       { color: "#5A6A80", fontSize: 13 },
  hairStyleBtnTextActive: { color: "#E0AAFF", fontWeight: "700" },

  // ── Pathway ──
  pathwayQuestion: {
    color: "#D0DCF4",
    fontSize: 19,
    fontWeight: "300",
    lineHeight: 28,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  pathwayOptions: {
    gap: 10,
  },
  pathwayOption: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(224,170,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pathwayOptionText: {
    color: "#B8C8E0",
    fontSize: 14,
    lineHeight: 21,
  },

  // ── Aptitude grid ──
  aptitudeGrid: {
    gap: 10,
  },
  aptitudeCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
    position: "relative",
  },
  recBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recBadgeText: {
    color: "#060E14",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  aptitudeSymbol: { fontSize: 22, marginBottom: 2 },
  aptitudeName:   { color: "#EEF2FF", fontSize: 15, fontWeight: "700" },
  aptitudeTrait:  { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 },
  aptitudeDesc:   { color: "#6A7A90", fontSize: 12, lineHeight: 18 },

  // ── Summary ──
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 18,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: "#4A5A70",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 4,
  },
  summaryAptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryAptSymbol: { fontSize: 28 },
  summaryAptName:   { color: "#EEF2FF", fontSize: 15, fontWeight: "700" },
  summaryAptTrait:  { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, marginTop: 2 },

  // ── Next / action buttons ──
  nextBtn: {
    backgroundColor: "#E0AAFF",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#E0AAFF",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: {
    color: "#060E14",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 10,
  },
  backLinkText: {
    color: "#4A5A70",
    fontSize: 13,
  },

  // ── Closing ──
  closingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  closingText: {
    color: "#D0DCF4",
    fontSize: 18,
    fontWeight: "300",
    letterSpacing: 2,
  },
  closingOverlay: {
    backgroundColor: "#060E14",
  },
});
