import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Sport } from "@/types";

interface SportIconProps {
  sport: Sport;
  size?: number;
  color?: string;
}

export function SportIcon({ sport, size = 20, color }: SportIconProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.primary;

  const getIcon = (): keyof typeof Feather.glyphMap => {
    switch (sport) {
      case "football":
        return "circle";
      case "basketball":
        return "target";
      case "cricket":
        return "disc";
      case "tennis":
        return "activity";
      default:
        return "circle";
    }
  };

  return (
    <View style={styles.container}>
      <Feather name={getIcon()} size={size} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
