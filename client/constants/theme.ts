import { Platform } from "react-native";

// Probaly Design System Colors
export const ProbalyColors = {
  primary: "#1E3A8A", // Deep Blue - trust, intelligence
  accent: "#3B82F6", // Bright Blue - interactive elements
  success: "#10B981", // Emerald - high confidence, correct predictions
  warning: "#F59E0B", // Amber - medium confidence
  error: "#EF4444", // Red - live indicator
  surface: "#F9FAFB", // Light Gray - card backgrounds
  border: "#E5E7EB", // Light Gray - borders
  textPrimary: "#111827", // Near Black
  textSecondary: "#6B7280", // Gray
  lowConfidence: "#6B7280", // Gray
  mediumConfidence: "#F59E0B", // Amber
  highConfidence: "#10B981", // Emerald
  liveIndicator: "#EF4444", // Red
};

const tintColorLight = ProbalyColors.primary;
const tintColorDark = ProbalyColors.accent;

export const Colors = {
  light: {
    text: ProbalyColors.textPrimary,
    textSecondary: ProbalyColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: ProbalyColors.textSecondary,
    tabIconSelected: tintColorLight,
    link: ProbalyColors.accent,
    primary: ProbalyColors.primary,
    accent: ProbalyColors.accent,
    success: ProbalyColors.success,
    warning: ProbalyColors.warning,
    error: ProbalyColors.error,
    border: ProbalyColors.border,
    backgroundRoot: "#FFFFFF",
    backgroundDefault: ProbalyColors.surface,
    backgroundSecondary: "#F3F4F6",
    backgroundTertiary: "#E5E7EB",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9CA3AF",
    tabIconSelected: tintColorDark,
    link: ProbalyColors.accent,
    primary: ProbalyColors.accent,
    accent: "#60A5FA",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    border: "#374151",
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  heading: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
