import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { colorScheme, themeMode, setThemeMode } = useThemeContext();
  const isDark = colorScheme === "dark";
  const theme = Colors[colorScheme];

  return {
    theme,
    isDark,
    themeMode,
    setThemeMode,
  };
}
