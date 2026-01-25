import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing, BetRightColors } from "@/constants/theme";

export function LiveBadge() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={styles.badge}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <ThemedText style={styles.text}>LIVE</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BetRightColors.liveIndicator,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
