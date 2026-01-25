import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="h4" style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable style={styles.action} onPress={onAction}>
          <ThemedText type="small" style={{ color: theme.accent }}>
            {actionLabel}
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontWeight: "600",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
  },
});
