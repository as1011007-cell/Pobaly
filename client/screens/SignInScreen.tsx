import React, { useState, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing } from "@/constants/theme";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";

interface SignInScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignIn">;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export default function SignInScreen({ navigation }: SignInScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { signIn, isLoading } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [cooldownText, setCooldownText] = useState("");
  const lastSubmitRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldownTimer = useCallback((unlockTime: number) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    const updateText = () => {
      const remaining = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));
      if (remaining <= 0) {
        setCooldownText("");
        setLockedUntil(null);
        setAttempts(0);
        setErrors({});
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setCooldownText(
        mins > 0
          ? t.tryAgainInMinSec.replace("{m}", String(mins)).replace("{s}", String(secs))
          : t.tryAgainInSec.replace("{s}", String(secs))
      );
    };
    updateText();
    cooldownTimerRef.current = setInterval(updateText, 1000);
  }, []);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = t.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = t.invalidEmail;
    } else if (trimmedEmail.length > 254) {
      newErrors.email = t.emailTooLong;
    }
    if (!password) {
      newErrors.password = t.passwordRequired;
    } else if (password.length < 6) {
      newErrors.password = t.passwordTooShort;
    } else if (password.length > 128) {
      newErrors.password = t.passwordTooLong;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (lockedUntil && Date.now() < lockedUntil) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const now = Date.now();
    if (now - lastSubmitRef.current < 1500) return;
    lastSubmitRef.current = now;

    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      await signIn(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAttempts(0);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = error?.message || "";

      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("too many")) {
        const unlockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(unlockTime);
        startCooldownTimer(unlockTime);
        setErrors({ general: t.tooManyAttemptsSignIn });
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        const unlockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(unlockTime);
        startCooldownTimer(unlockTime);
        setErrors({ general: t.tooManyAttemptsSignIn });
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setErrors({
          general:
            remaining === 1
              ? t.invalidEmailPasswordOne
              : t.invalidEmailPasswordRem.replace("{n}", String(remaining)),
        });
      }
    }
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const isDisabled = isLoading || isLocked;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing["2xl"],
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.title}>
          {t.welcomeBack}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {t.signInToAccess}
        </ThemedText>
      </View>

      <View style={styles.form}>
        {errors.general ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.accent + "18" }]}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {errors.general}
            </ThemedText>
            {cooldownText ? (
              <ThemedText type="small" style={[styles.cooldownText, { color: theme.accent }]}>
                {cooldownText}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <TextInput
          label={t.email}
          leftIcon="mail"
          placeholder={t.enterEmail}
          value={email}
          onChangeText={(v) => { setEmail(v); setErrors({}); }}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!isLocked}
          testID="input-email"
        />
        <TextInput
          label={t.password}
          leftIcon="lock"
          placeholder={t.enterPassword}
          value={password}
          onChangeText={(v) => { setPassword(v); setErrors({}); }}
          error={errors.password}
          isPassword
          autoCapitalize="none"
          autoComplete="password"
          editable={!isLocked}
          testID="input-password"
        />

        <Pressable
          onPress={() => navigation.navigate("ForgotPassword")}
          style={styles.forgotPassword}
        >
          <ThemedText type="small" style={{ color: theme.accent }}>
            {t.forgotPasswordQ}
          </ThemedText>
        </Pressable>

        <Button
          onPress={handleSignIn}
          disabled={isDisabled}
          style={[styles.button, isLocked ? { opacity: 0.5 } : undefined]}
          testID="button-signin"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : isLocked ? (
            cooldownText || t.locked
          ) : (
            t.signInButton
          )}
        </Button>

      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {t.dontHaveAccount}
        </ThemedText>
        <Pressable onPress={() => navigation.navigate("SignUp")}>
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: "600" }}>
            {t.signUpButton}
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    marginBottom: Spacing.sm,
  },
  form: {
    flex: 1,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing.xl,
    marginTop: -Spacing.sm,
  },
  button: {
    marginTop: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  errorBanner: {
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  cooldownText: {
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
});
