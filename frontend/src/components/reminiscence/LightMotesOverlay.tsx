import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

// Soft drifting light-motes overlay — gentle glowing specks that rise and fade,
// used for warm/hopeful and divine golden scenes. Code-driven particles, no
// heavy assets. Loops indefinitely while mounted.
export function LightMotesOverlay({ density = 1, color = "#FBE7B0" }: { density?: number; color?: string }) {
  const { width, height } = useWindowDimensions();
  const count = Math.round(10 * density);

  const motes = useRef(
    Array.from({ length: count }).map(() => ({
      x: Math.random() * width,
      startY: height * (0.5 + Math.random() * 0.5),
      delay: Math.random() * 5000,
      duration: 5500 + Math.random() * 4500,
      size: 3 + Math.random() * 6,
      drift: (Math.random() - 0.5) * 50,
      rise: 120 + Math.random() * 220,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const loops = motes.map((m) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(m.delay),
          Animated.timing(m.anim, {
            toValue: 1,
            duration: m.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(m.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {motes.map((m, i) => {
        const translateY = m.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -m.rise] });
        const translateX = m.anim.interpolate({ inputRange: [0, 1], outputRange: [0, m.drift] });
        const opacity = m.anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.9, 0.7, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: m.x,
              top: m.startY,
              width: m.size,
              height: m.size,
              borderRadius: m.size,
              backgroundColor: color,
              opacity,
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              transform: [{ translateY }, { translateX }],
            }}
          />
        );
      })}
    </View>
  );
}
