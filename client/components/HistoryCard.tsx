import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";

import { ThemedText } from "@/components/ThemedText";
import { SportIcon } from "@/components/SportIcon";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Prediction } from "@/types";

interface HistoryCardProps {
  prediction: Prediction;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HistoryCard({ prediction, onPress }: HistoryCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isCorrect = prediction.result === "correct";
  const resultColor = isCorrect ? theme.success : theme.error;
  const resultIcon = isCorrect ? "check-circle" : "x-circle";
  const resultLabel = isCorrect ? "Correct" : "Incorrect";

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
    >
      <View style={styles.leftSection}>
        <View style={styles.header}>
          <SportIcon sport={prediction.sport} size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
            {format(new Date(prediction.matchTime), "MMM d, yyyy")}
          </ThemedText>
        </View>
        <ThemedText type="body" style={styles.matchTitle} numberOfLines={1}>
          {prediction.matchTitle}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
          {prediction.predictedOutcome} ({prediction.probability}%)
        </ThemedText>
      </View>

      <View style={styles.rightSection}>
        <View style={[styles.resultBadge, { backgroundColor: `${resultColor}15` }]}>
          <Feather name={resultIcon} size={16} color={resultColor} />
          <ThemedText type="small" style={[styles.resultText, { color: resultColor }]}>
            {resultLabel}
          </ThemedText>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
  },
  leftSection: {
    flex: 1,
    marginRight: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  matchTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  rightSection: {
    alignItems: "flex-end",
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  resultText: {
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
});
