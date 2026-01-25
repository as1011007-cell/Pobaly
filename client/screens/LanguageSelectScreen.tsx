import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { Language } from "@/lib/translations";

export default function LanguageSelectScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { language, setLanguage, languages, t } = useLanguage();

  const handleLanguageSelect = async (langCode: Language) => {
    await setLanguage(langCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundRoot,
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        {languages.map((lang, index) => (
          <Pressable
            key={lang.code}
            style={[
              styles.languageRow,
              index < languages.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              },
            ]}
            onPress={() => handleLanguageSelect(lang.code)}
          >
            <View style={styles.languageInfo}>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                {lang.nativeName}
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: 2 }}
              >
                {lang.name}
              </ThemedText>
            </View>
            {language === lang.code ? (
              <Feather name="check" size={20} color={theme.primary} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <ThemedText
        type="small"
        style={[styles.hint, { color: theme.textSecondary }]}
      >
        {t.language === "Idioma"
          ? "El idioma se guardará en tu cuenta"
          : t.language === "Langue"
          ? "La langue sera enregistrée dans votre compte"
          : "Language will be saved to your account"}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  languageInfo: {
    flex: 1,
  },
  hint: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
