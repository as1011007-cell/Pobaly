import React from "react";
import { View, StyleSheet, ScrollView, Linking, Pressable } from "react-native";
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
        Terms of Use (EULA)
      </ThemedText>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last updated: April 2026
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          1. Acceptance of Terms
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          By accessing or using Probaly, you agree to be bound by these Terms of Use (End User License Agreement). If you do not agree to these terms, please do not use the app.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          2. Description of Service
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly provides AI-powered sports prediction insights for informational and entertainment purposes only. Our predictions are based on data analysis and should not be considered as financial advice or gambling recommendations. You must be 17 or older to use this service.
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
          4. Auto-Renewable Subscriptions
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly offers the following auto-renewable subscription plans for "Probaly Premium":
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          {"\u2022"} Monthly Plan: $49.99 per month{"\n"}
          {"\u2022"} Annual Plan: $149.00 per year ($12.42/month)
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Premium subscribers get unlimited access to all AI-powered predictions across all sports, live match updates, advanced filters, full prediction history, and analytics.
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Payment will be charged to your Apple ID account (iOS) or Google Play account (Android) at confirmation of purchase. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period at the same price. You can manage and cancel your subscriptions by going to your account settings on the App Store or Google Play Store after purchase.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          5. Free Trial
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          If a free trial is offered, any unused portion will be forfeited when you purchase a subscription. You can cancel the free trial at any time during the trial period.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          6. Disclaimer
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly predictions are for entertainment and informational purposes only. We do not guarantee the accuracy of any predictions. Past performance does not guarantee future results. Users should make their own informed decisions. Probaly is not a gambling platform and does not facilitate betting.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          7. Prohibited Activities
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          You may not use Probaly for any illegal purposes, including but not limited to: unauthorized gambling in jurisdictions where it is prohibited, money laundering, or any activity that violates local, state, or federal laws.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          8. Limitation of Liability
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Probaly shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use our service, or from any decisions made based on our predictions.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          9. Changes to Terms
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          10. Privacy Policy
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Your use of Probaly is also governed by our Privacy Policy. Please review it to understand how we collect, use, and protect your information.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          11. Contact Us
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          If you have any questions about these Terms of Use, please contact us at support@probaly.app
        </ThemedText>
        <Pressable onPress={() => Linking.openURL("https://probaly.net/terms")} style={styles.webLink}>
          <ThemedText type="small" style={{ color: theme.primary }}>
            View full Terms of Use at probaly.net/terms
          </ThemedText>
        </Pressable>
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
    marginBottom: Spacing.sm,
  },
  webLink: {
    marginTop: Spacing.sm,
  },
});
