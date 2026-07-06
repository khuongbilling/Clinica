import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

// Soft drifting lotus-petal overlay — a lightweight, code-driven particle
// effect (no video/heavy assets). Loops indefinitely while mounted.
export function LotusPetalOverlay({ density = 1, color = "#FFF3D6" }: { density?: number; color?: string }) {
  const { width, height } = useWindowDimensions();
  const count = Math.round(6 * density);

  const petals = useRef(
    Array.from({ length: count }).map(() => ({
      x: Math.random() * width,
      delay: Math.random() * 4000,
      duration: 6000 + Math.random() * 4000,
      size: 9 + Math.random() * 9,
      drift: (Math.random() - 0.5) * 70,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const loops = petals.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, {
            toValue: 1,
            duration: p.duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {petals.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] });
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 0.85, 0.85, 0] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "220deg"] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 1.3,
              borderRadius: p.size,
              backgroundColor: color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
