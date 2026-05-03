import React, { useRef, useEffect } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface SkeletonCardProps {
  variant?: "hero" | "default" | "compact";
}

/**
 * Pulsing placeholder shown while a PredictionCard's data is loading.
 * Matches the approximate height of each card variant so the layout doesn't
 * jump when real data arrives.
 */
export function SkeletonCard({ variant = "compact" }: SkeletonCardProps) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  const bgColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";
  const lineColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";

  const cardHeight = variant === "hero" ? 190 : variant === "compact" ? 115 : 155;

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: bgColor, height: cardHeight, opacity }]}
    >
      <View style={[styles.line, styles.lineShort, { backgroundColor: lineColor }]} />
      <View style={[styles.line, styles.lineLong, { backgroundColor: lineColor }]} />
      <View style={[styles.line, styles.lineMedium, { backgroundColor: lineColor }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    width: "100%",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  line: {
    borderRadius: 4,
    height: 10,
  },
  lineShort: {
    width: "40%",
  },
  lineLong: {
    width: "90%",
  },
  lineMedium: {
    width: "65%",
  },
});
