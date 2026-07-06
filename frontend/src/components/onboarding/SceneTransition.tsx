import { ReactNode, useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";

/**
 * Push 7 — one shared cinematic entry animation for onboarding screens, so
 * every beat (prologue, lotus recall, post-recall sub-steps, university
 * arrival) fades + gently scales in the same way instead of each screen
 * hand-rolling its own `fadeAnim`. Re-triggers whenever `trigger` changes
 * (e.g. a sub-view switch within the same screen), so multi-step screens
 * like post-recall get a fresh cinematic beat per step.
 */
export function SceneTransition({
  children,
  trigger,
  duration = 650,
  style,
}: {
  children: ReactNode;
  trigger?: string | number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [trigger, duration, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });

  return (
    <Animated.View
      style={[style, { opacity: anim, transform: [{ translateY }, { scale }] }]}
      testID="scene-transition"
    >
      {children}
    </Animated.View>
  );
}
