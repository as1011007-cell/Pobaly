import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { ConfidenceLevel } from "@/types";

interface ProbabilityBarProps {
  probability: number;
  confidence: ConfidenceLevel;
  isLive?: boolean;
  height?: number;
}

export function ProbabilityBar({
  probability,
  confidence,
  isLive = false,
  height = 8,
}: ProbabilityBarProps) {
  const { theme } = useTheme();
  const width = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    width.value = withSpring(probability / 100, {
      damping: 15,
      stiffness: 100,
    });

    if (isLive) {
      pulse.value = withRepeat(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }
  }, [probability, isLive]);

  const getColors = (): readonly [string, string] => {
    switch (confidence) {
      case "high":
        return [theme.success, "#34D399"] as const;
      case "medium":
        return [theme.warning, "#FCD34D"] as const;
      case "low":
        return [theme.textSecondary, "#9CA3AF"] as const;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    opacity: isLive ? pulse.value : 1,
  }));

  return (
    <View
      style={[
        styles.container,
        { height, backgroundColor: theme.backgroundSecondary },
      ]}
    >
      <Animated.View style={[styles.fill, animatedStyle]}>
        <LinearGradient
          colors={getColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
});
