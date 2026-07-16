/**
 * Shared animation hooks for Journey Map visual maps.
 * Used by Chapter1VisualMap–Chapter5VisualMap and GenericChapterVisualMap.
 */
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

/**
 * Returns three animation values for a visual map canvas:
 *  - pulse       : inner glow ring opacity  (0.3 → 1 → 0.3,  ~950 ms loop)
 *  - pulseOuter  : outer glow ring opacity  (0.08 → 0.45, ~1.4 s loop, offset phase)
 *  - entranceAnims : per-node spring scale + opacity entrance (stagger 70 ms)
 */
export function useVisualMapAnims(nodeCount: number) {
  const pulse         = useRef(new Animated.Value(0.3)).current;
  const pulseOuter    = useRef(new Animated.Value(0.08)).current;
  const entranceAnims = useRef(
    Array.from({ length: nodeCount }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 950, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.3, duration: 950, useNativeDriver: false }),
      ]),
    );
    const loopOuter = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOuter, { toValue: 0.45, duration: 1400, useNativeDriver: false }),
        Animated.timing(pulseOuter, { toValue: 0.08, duration: 1400, useNativeDriver: false }),
      ]),
    );
    const entrance = Animated.stagger(
      70,
      entranceAnims.map((a) =>
        Animated.spring(a, {
          toValue:  1,
          tension:  160,
          friction: 10,
          useNativeDriver: true,
        }),
      ),
    );
    loop.start();
    loopOuter.start();
    entrance.start();
    return () => {
      loop.stop();
      loopOuter.stop();
    };
  }, []);

  return { pulse, pulseOuter, entranceAnims };
}
