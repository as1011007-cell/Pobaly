import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h3" style={styles.title}>
        Terms of Service
      </ThemedText>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last updated: January 2026
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          1. Acceptance of Terms
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          By accessing or using Probaly, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          2. Description of Service
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly provides AI-powered sports prediction insights for informational purposes only. Our predictions are based on data analysis and should not be considered as financial advice or gambling recommendations.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          3. User Accounts
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          4. Premium Subscription
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly offers a premium subscription at $49/year. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period. You can manage your subscription through your account settings.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          5. Disclaimer
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly predictions are for entertainment and informational purposes only. We do not guarantee the accuracy of any predictions. Past performance does not guarantee future results. Users should make their own informed decisions.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          6. Prohibited Activities
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          You may not use Probaly for any illegal purposes, including but not limited to: unauthorized gambling in jurisdictions where it is prohibited, money laundering, or any activity that violates local, state, or federal laws.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          7. Limitation of Liability
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use our service, or from any decisions made based on our predictions.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          8. Changes to Terms
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          9. Contact Us
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          If you have any questions about these Terms of Service, please contact us at support@probaly.app
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  paragraph: {
    lineHeight: 24,
  },
});
