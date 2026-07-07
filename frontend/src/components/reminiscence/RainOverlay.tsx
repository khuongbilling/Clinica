import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

// Lightweight code-driven rain overlay — thin translucent streaks falling on a
// loop. Used for the cold, grief-heavy scenes (no video / heavy asset). Loops
// indefinitely while mounted.
export function RainOverlay({ density = 1, color = "#BFD4E8" }: { density?: number; color?: string }) {
  const { width, height } = useWindowDimensions();
  const count = Math.round(28 * density);

  const drops = useRef(
    Array.from({ length: count }).map(() => ({
      x: Math.random() * width,
      delay: Math.random() * 1400,
      duration: 700 + Math.random() * 700,
      length: 14 + Math.random() * 26,
      thickness: 1 + Math.random() * 1.2,
      opacity: 0.12 + Math.random() * 0.28,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const loops = drops.map((d) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.timing(d.anim, {
            toValue: 1,
            duration: d.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(d.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((d, i) => {
        const translateY = d.anim.interpolate({ inputRange: [0, 1], outputRange: [-d.length - 20, height + 20] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: 0,
              width: d.thickness,
              height: d.length,
              borderRadius: d.thickness,
              backgroundColor: color,
              opacity: d.opacity,
              transform: [{ translateY }, { rotate: "12deg" }],
            }}
          />
        );
      })}
    </View>
  );
}
