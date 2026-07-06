import { useEffect, useState } from "react";
import { Text, TextStyle } from "react-native";

// Lightweight typewriter effect for "SYSTEM:" lines in the reminiscence
// motion-comic. No external deps — a setInterval revealing one character at a
// time, safe to unmount/retrigger when `text` changes.
export function TypedText({
  text,
  speed = 22,
  delay = 0,
  style,
  onDone,
}: {
  text: string;
  speed?: number;
  delay?: number;
  style?: TextStyle | TextStyle[];
  onDone?: () => void;
}) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    setShown("");

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          if (interval) clearInterval(interval);
          onDone?.();
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, delay]);

  return <Text style={style}>{shown}</Text>;
}
