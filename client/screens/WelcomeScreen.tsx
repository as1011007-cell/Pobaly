import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";

interface WelcomeScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
}

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundRoot,
          paddingTop: insets.top + Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing["2xl"],
        },
      ]}
    >
      <View style={styles.content}>
        <Image
          source={require("../../assets/images/welcome-hero.png")}
          style={styles.heroImage}
          resizeMode="contain"
        />

        <View style={styles.textContainer}>
          <ThemedText type="h1" style={styles.title}>
            Probaly
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Sports Intelligence, Probability-Driven
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.description, { color: theme.textSecondary }]}
          >
            AI-powered predictions backed by data analytics. Make informed
            decisions with transparent probability insights.
          </ThemedText>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          onPress={() => navigation.navigate("SignUp")}
          style={styles.primaryButton}
        >
          Get Started
        </Button>
        <Button
          onPress={() => navigation.navigate("SignIn")}
          style={[styles.secondaryButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
            Sign In
          </ThemedText>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroImage: {
    width: 280,
    height: 280,
    marginBottom: Spacing["3xl"],
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
  footer: {
    gap: Spacing.md,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
  },
});
