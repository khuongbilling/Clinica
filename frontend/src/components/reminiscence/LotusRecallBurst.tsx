import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Easing } from "react-native";

// One-shot white-gold radial burst used for the Lotus Recall moment — a plain
// scaling/fading circle (no video, no heavy asset) that reads as a magical
// flash without needing true radial-gradient support.
export function LotusRecallBurst() {
  const scale = useRef(new Animated.Value(0.15)).current;
  const opacity = useRef(new Animated.Value(0.95)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.15);
    opacity.setValue(0.95);
    flash.setValue(0.6);

    Animated.parallel([
      Animated.timing(scale, {
        toValue: 3.4,
        duration: 1900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity, flash]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.flash, { opacity: flash }]} />
      <Animated.View style={[styles.ring, { transform: [{ scale }], opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFDF3" },
  ring: {
    position: "absolute",
    top: "34%",
    left: "50%",
    width: 190,
    height: 190,
    marginLeft: -95,
    marginTop: -95,
    borderRadius: 999,
    backgroundColor: "#FFF7DB",
    shadowColor: "#F4D06F",
    shadowOpacity: 0.9,
    shadowRadius: 60,
    elevation: 12,
  },
});
