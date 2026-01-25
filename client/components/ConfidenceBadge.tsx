import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { ConfidenceLevel } from "@/types";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  size?: "small" | "medium" | "large";
}

export function ConfidenceBadge({
  level,
  size = "medium",
}: ConfidenceBadgeProps) {
  const { theme } = useTheme();

  const getColor = () => {
    switch (level) {
      case "high":
        return theme.success;
      case "medium":
        return theme.warning;
      case "low":
        return theme.textSecondary;
    }
  };

  const getLabel = () => {
    switch (level) {
      case "high":
        return "High Confidence";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
    }
  };

  const getSize = () => {
    switch (size) {
      case "small":
        return { paddingHorizontal: Spacing.sm, paddingVertical: 2 };
      case "medium":
        return { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs };
      case "large":
        return { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm };
    }
  };

  const color = getColor();

  return (
    <View
      style={[
        styles.badge,
        getSize(),
        { backgroundColor: `${color}15`, borderColor: `${color}30` },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText
        type="small"
        style={[
          styles.text,
          { color },
          size === "small" && { fontSize: 11 },
          size === "large" && { fontSize: 14 },
        ]}
      >
        {getLabel()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  text: {
    fontWeight: "600",
  },
});
