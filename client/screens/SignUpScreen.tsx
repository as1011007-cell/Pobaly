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

interface SignUpScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignUp">;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000;

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { signUp, isLoading } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});
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
    const newErrors: { name?: string; email?: string; password?: string } = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      newErrors.name = t.nameRequired;
    } else if (trimmedName.length > 100) {
      newErrors.name = t.nameTooLong;
    }
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

  const handleSignUp = async () => {
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
      await signUp(email.trim(), password, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAttempts(0);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = error?.message || "";

      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("too many")) {
        const unlockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(unlockTime);
        startCooldownTimer(unlockTime);
        setErrors({ general: t.tooManyAttemptsSignUp });
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        const unlockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(unlockTime);
        startCooldownTimer(unlockTime);
        setErrors({ general: t.tooManyAttemptsSignUp });
      } else {
        let msg = t.registrationFailed;
        if (errorMsg.includes("Unable to create account")) {
          msg = t.unableToCreateAccount;
        } else if (errorMsg.includes("doesn't appear to exist") || errorMsg.includes("valid email")) {
          msg = t.emailDoesntExist;
          setErrors({ email: msg });
          return;
        }
        setErrors({ general: msg });
      }
    }
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const isDisabled = isLoading || isLocked;
  const clearErrors = () => setErrors({});

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
          {t.createAccountTitle}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {t.startYourJourney}
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
          label={t.fullName}
          leftIcon="user"
          placeholder={t.enterName}
          value={name}
          onChangeText={(v) => { setName(v); clearErrors(); }}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          editable={!isLocked}
          testID="input-name"
        />
        <TextInput
          label={t.email}
          leftIcon="mail"
          placeholder={t.enterEmail}
          value={email}
          onChangeText={(v) => { setEmail(v); clearErrors(); }}
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
          placeholder={t.createPasswordPlaceholder}
          value={password}
          onChangeText={(v) => { setPassword(v); clearErrors(); }}
          error={errors.password}
          isPassword
          autoCapitalize="none"
          autoComplete="password-new"
          editable={!isLocked}
          testID="input-password"
        />

        <Button
          onPress={handleSignUp}
          disabled={isDisabled}
          style={[styles.button, isLocked ? { opacity: 0.5 } : undefined]}
          testID="button-signup"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : isLocked ? (
            cooldownText || t.locked
          ) : (
            t.createAccountButton
          )}
        </Button>

        <ThemedText
          type="small"
          style={[styles.terms, { color: theme.textSecondary }]}
        >
          {t.byCreatingAccount}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {t.alreadyHaveAccount}
        </ThemedText>
        <Pressable onPress={() => navigation.navigate("SignIn")}>
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: "600" }}>
            {t.signInButton}
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
  button: {
    marginTop: Spacing.md,
  },
  terms: {
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 20,
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
