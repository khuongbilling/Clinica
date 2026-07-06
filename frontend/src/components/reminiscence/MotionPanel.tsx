import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import type { ReactNode } from "react";

export type PanelEffect = "fadeIn" | "zoomIn" | "panSlow" | "pulse" | "lotusRecall";

// Applies one light-motion effect (fade / slow zoom / slow pan / gentle pulse)
// to a still illustration — this is the "motion" in motion-comic, without any
// frame-by-frame animation or video assets.
export function MotionPanel({
  source,
  effect = "fadeIn",
  children,
}: {
  source: number;
  effect?: PanelEffect;
  children?: ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    scale.setValue(effect === "zoomIn" ? 1.1 : 1);
    translateX.setValue(effect === "panSlow" ? -16 : 0);
    pulse.setValue(1);

    Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }).start();

    if (effect === "zoomIn") {
      Animated.timing(scale, {
        toValue: 1,
        duration: 7000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }

    if (effect === "panSlow") {
      Animated.timing(translateX, {
        toValue: 16,
        duration: 9000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start();
    }

    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (effect === "pulse" || effect === "lotusRecall") {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.045, duration: 950, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 950, useNativeDriver: true }),
        ]),
      );
      pulseLoop.start();
    }

    return () => {
      pulseLoop?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, effect]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: Animated.multiply(scale, pulse) }, { translateX }] },
        ]}
      >
        <ExpoImage source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      </Animated.View>
      {children}
    </Animated.View>
  );
}
