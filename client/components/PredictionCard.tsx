import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { ThemedText } from "@/components/ThemedText";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { SportIcon } from "@/components/SportIcon";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { LiveBadge } from "@/components/LiveBadge";
import { SportsbookOddsDisplay } from "@/components/SportsbookOddsDisplay";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Typography } from "@/constants/theme";
import { Prediction } from "@/types";

interface PredictionCardProps {
  prediction: Prediction;
  isLocked?: boolean;
  variant?: "default" | "hero" | "compact";
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PredictionCard({
  prediction,
  isLocked = false,
  variant = "default",
  onPress,
}: PredictionCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formattedTime = format(new Date(prediction.matchTime), "MMM d, h:mm a");

  const isHero = variant === "hero";
  const isCompact = variant === "compact";

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        {
          backgroundColor: isHero
            ? theme.primary
            : theme.backgroundDefault,
        },
        isHero && styles.heroContainer,
        isCompact && styles.compactContainer,
        animatedStyle,
      ]}
    >
      {isLocked && (
        <>
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={styles.lockedOverlay}
          />
          <View style={styles.lockContainer}>
            <View style={[styles.lockIconBox, { backgroundColor: theme.primary }]}>
              <Feather name="lock" size={20} color="#FFFFFF" />
            </View>
            <ThemedText type="body" style={[styles.lockText, { color: theme.text }]}>
              Premium Only
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Subscribe to unlock this prediction
            </ThemedText>
          </View>
        </>
      )}

      <View style={styles.header}>
        <View style={styles.sportBadge}>
          <SportIcon
            sport={prediction.sport}
            size={16}
            color={isHero ? "#FFFFFF" : theme.primary}
          />
          <ThemedText
            type="small"
            style={[
              styles.sportText,
              { color: isHero ? "rgba(255,255,255,0.8)" : theme.textSecondary },
            ]}
          >
            {prediction.sport.charAt(0).toUpperCase() + prediction.sport.slice(1)}
          </ThemedText>
        </View>
        {prediction.isLive ? (
          <LiveBadge />
        ) : (
          <ThemedText
            type="small"
            style={[
              styles.time,
              { color: isHero ? "rgba(255,255,255,0.8)" : theme.textSecondary },
            ]}
          >
            {formattedTime}
          </ThemedText>
        )}
      </View>

      <ThemedText
        type={isHero ? "h3" : "body"}
        style={[
          styles.matchTitle,
          { color: isHero ? "#FFFFFF" : theme.text },
          isCompact && { fontSize: 14 },
        ]}
        numberOfLines={isCompact ? 1 : 2}
      >
        {prediction.matchTitle}
      </ThemedText>

      <View style={styles.predictionRow}>
        <ThemedText
          type={isHero ? "h4" : "body"}
          style={[
            styles.outcome,
            { color: isHero ? "#FFFFFF" : theme.text },
            isCompact && { fontSize: 13 },
          ]}
        >
          {prediction.predictedOutcome}
        </ThemedText>
      </View>

      <View style={styles.probabilitySection}>
        <View style={styles.probabilityHeader}>
          <ThemedText
            type="h2"
            style={[
              styles.probabilityText,
              { color: isHero ? "#FFFFFF" : theme.primary },
              isCompact && { fontSize: 24 },
            ]}
          >
            {prediction.probability}%
          </ThemedText>
          <ConfidenceBadge level={prediction.confidence} size={isCompact ? "small" : "medium"} />
        </View>
        {!isCompact && (
          <ProbabilityBar
            probability={prediction.probability}
            confidence={prediction.confidence}
            isLive={prediction.isLive}
            height={isHero ? 10 : 6}
          />
        )}
      </View>

      {!isCompact && !isLocked && prediction.sportsbookOdds ? (
        <SportsbookOddsDisplay odds={prediction.sportsbookOdds} />
      ) : (
        !isCompact && prediction.explanation && (
          <ThemedText
            type="small"
            style={[
              styles.explanation,
              { color: isHero ? "rgba(255,255,255,0.85)" : theme.textSecondary },
            ]}
            numberOfLines={2}
          >
            {prediction.explanation}
          </ThemedText>
        )
      )}

      {isHero && (
        <View style={styles.heroFooter}>
          <View style={styles.viewDetailsButton}>
            <ThemedText style={styles.viewDetailsText}>View Details</ThemedText>
            <Feather name="chevron-right" size={16} color="#FFFFFF" />
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    overflow: "hidden",
  },
  heroContainer: {
    padding: Spacing["2xl"],
  },
  compactContainer: {
    padding: Spacing.md,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    borderRadius: BorderRadius.lg,
  },
  lockContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 11,
    padding: Spacing.lg,
  },
  lockIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  lockText: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sportText: {
    fontWeight: "500",
    textTransform: "capitalize",
  },
  time: {
    fontWeight: "500",
  },
  matchTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  predictionRow: {
    marginBottom: Spacing.md,
  },
  outcome: {
    fontWeight: "700",
  },
  probabilitySection: {
    gap: Spacing.sm,
  },
  probabilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  probabilityText: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    lineHeight: 40,
    includeFontPadding: true,
  },
  explanation: {
    marginTop: Spacing.md,
    lineHeight: 20,
  },
  heroFooter: {
    marginTop: Spacing.lg,
    alignItems: "flex-start",
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  viewDetailsText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginRight: Spacing.xs,
  },
});
