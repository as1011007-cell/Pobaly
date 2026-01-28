import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface AffiliateStats {
  totalEarnings: number;
  pendingEarnings: number;
  clearedEarnings: number;
  processingEarnings: number;
  paidEarnings: number;
  totalReferrals: number;
  commissionRate: number;
}

interface Referral {
  id: number;
  referredUserId: string;
  commissionAmount: number;
  status: string;
  createdAt: string;
}

interface AffiliateData {
  affiliate: {
    id: number;
    affiliateCode: string;
    referralLink: string;
    stripeConnectOnboarded: boolean;
  };
  stats: AffiliateStats;
  referrals: Referral[];
}

export default function AffiliateScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAffiliateData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/affiliate/dashboard/${user.id}`, baseUrl);
      const response = await fetch(url.toString());

      if (response.ok) {
        const data = await response.json();
        setAffiliateData(data);
        setIsAffiliate(true);
      } else if (response.status === 404) {
        setIsAffiliate(false);
      }
    } catch (error) {
      console.error("Failed to fetch affiliate data:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAffiliateData();
  }, [fetchAffiliateData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAffiliateData();
  }, [fetchAffiliateData]);

  const handleRegister = async () => {
    if (!user?.id) return;
    setIsRegistering(true);

    try {
      const baseUrl = getApiUrl();
      const response = await apiRequest("POST", new URL("/api/affiliate/register", baseUrl).toString(), {
        userId: user.id,
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchAffiliateData();
      }
    } catch (error) {
      console.error("Failed to register as affiliate:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!user?.id) return;
    setIsConnecting(true);

    try {
      const baseUrl = getApiUrl();
      const response = await apiRequest("POST", new URL("/api/affiliate/connect-stripe", baseUrl).toString(), {
        userId: user.id,
      });

      const data = await response.json();
      
      if (response.ok && data.url) {
        await WebBrowser.openBrowserAsync(data.url);
        await fetchAffiliateData();
      } else {
        console.error("Stripe Connect failed:", data.error, data.details);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error("Failed to connect Stripe:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!user?.id) return;
    setIsRequestingPayout(true);

    try {
      const baseUrl = getApiUrl();
      const response = await apiRequest("POST", new URL("/api/affiliate/request-payout", baseUrl).toString(), {
        userId: user.id,
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await fetchAffiliateData();
      }
    } catch (error) {
      console.error("Failed to request payout:", error);
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const handleCopyLink = async () => {
    if (!affiliateData?.affiliate.referralLink) return;

    await Clipboard.setStringAsync(affiliateData.affiliate.referralLink);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!affiliateData?.affiliate.referralLink) return;

    try {
      await Share.share({
        message: `Join Probaly and get AI-powered sports predictions! Use my link: ${affiliateData.affiliate.referralLink}`,
        url: affiliateData.affiliate.referralLink,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!isAffiliate) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.heroSection}>
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="users" size={48} color={theme.primary} />
          </View>
          <ThemedText style={styles.heroTitle}>Become an Affiliate</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Earn 40% commission on every subscription purchased through your referral link
          </ThemedText>
        </View>

        <View style={[styles.benefitsCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.benefitsTitle}>Benefits</ThemedText>
          <View style={styles.benefitRow}>
            <Feather name="dollar-sign" size={20} color={theme.success} />
            <ThemedText style={styles.benefitText}>40% commission on all sales</ThemedText>
          </View>
          <View style={styles.benefitRow}>
            <Feather name="credit-card" size={20} color={theme.success} />
            <ThemedText style={styles.benefitText}>Direct payouts to your bank</ThemedText>
          </View>
          <View style={styles.benefitRow}>
            <Feather name="bar-chart-2" size={20} color={theme.success} />
            <ThemedText style={styles.benefitText}>Real-time tracking dashboard</ThemedText>
          </View>
          <View style={styles.benefitRow}>
            <Feather name="link" size={20} color={theme.success} />
            <ThemedText style={styles.benefitText}>Unique referral link</ThemedText>
          </View>
        </View>

        <Button
          onPress={handleRegister}
          disabled={isRegistering}
          style={styles.registerButton}
        >
          {isRegistering ? "Registering..." : "Join Affiliate Program"}
        </Button>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
    >
      <View style={[styles.statsGrid, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: theme.success }]}>
            ${affiliateData?.stats.clearedEarnings?.toFixed(2) || "0.00"}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Ready to Pay
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: theme.warning }]}>
            ${affiliateData?.stats.processingEarnings?.toFixed(2) || "0.00"}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Processing
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: theme.primary }]}>
            {affiliateData?.stats.totalReferrals}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Referrals
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { color: theme.accent }]}>
            ${affiliateData?.stats.paidEarnings?.toFixed(2) || "0.00"}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Paid Out
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.clearanceNote, { color: theme.textSecondary }]}>
        Commissions are available for payout 14 business days after payment clears
      </ThemedText>

      <View style={[styles.linkCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={styles.sectionTitle}>Your Referral Link</ThemedText>
        <View style={[styles.linkContainer, { backgroundColor: theme.backgroundRoot }]}>
          <ThemedText style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={1}>
            {affiliateData?.affiliate.referralLink}
          </ThemedText>
        </View>
        <View style={styles.linkActions}>
          <Pressable
            style={[styles.linkButton, { backgroundColor: theme.primary }]}
            onPress={handleCopyLink}
          >
            <Feather name={copied ? "check" : "copy"} size={18} color="#fff" />
            <ThemedText style={styles.linkButtonText}>
              {copied ? "Copied!" : "Copy"}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.linkButton, { backgroundColor: theme.accent }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={18} color="#fff" />
            <ThemedText style={styles.linkButtonText}>Share</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.payoutCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={styles.sectionTitle}>Payouts</ThemedText>
        {affiliateData?.affiliate.stripeConnectOnboarded ? (
          <>
            <ThemedText style={[styles.payoutInfo, { color: theme.textSecondary }]}>
              Bank account connected. Minimum payout: $10
            </ThemedText>
            <Button
              onPress={handleRequestPayout}
              disabled={
                isRequestingPayout ||
                (affiliateData?.stats.clearedEarnings || 0) < 10
              }
              style={styles.payoutButton}
            >
              {isRequestingPayout ? "Processing..." : "Request Payout"}
            </Button>
          </>
        ) : (
          <>
            <ThemedText style={[styles.payoutInfo, { color: theme.textSecondary }]}>
              Connect your bank account to receive payouts
            </ThemedText>
            <Button
              onPress={handleConnectStripe}
              disabled={isConnecting}
              style={styles.payoutButton}
            >
              {isConnecting ? "Connecting..." : "Connect Bank Account"}
            </Button>
          </>
        )}
      </View>

      {affiliateData && affiliateData.referrals.length > 0 ? (
        <View style={[styles.referralsCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.sectionTitle}>Recent Referrals</ThemedText>
          {affiliateData.referrals.slice(0, 10).map((referral) => (
            <View
              key={referral.id}
              style={[styles.referralItem, { borderBottomColor: theme.border }]}
            >
              <View>
                <ThemedText style={styles.referralAmount}>
                  +${(referral.commissionAmount / 100).toFixed(2)}
                </ThemedText>
                <ThemedText style={[styles.referralDate, { color: theme.textSecondary }]}>
                  {new Date(referral.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      referral.status === "paid" ? theme.success + "20" : theme.warning + "20",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.statusText,
                    { color: referral.status === "paid" ? theme.success : theme.warning },
                  ]}
                >
                  {referral.status}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.codeSection}>
        <ThemedText style={[styles.codeLabel, { color: theme.textSecondary }]}>
          Your Affiliate Code
        </ThemedText>
        <ThemedText style={[styles.codeValue, { color: theme.primary }]}>
          {affiliateData?.affiliate.affiliateCode}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  benefitsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  benefitText: {
    fontSize: 15,
  },
  registerButton: {
    marginTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  statItem: {
    width: "50%",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  clearanceNote: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: Spacing.lg,
    fontStyle: "italic",
  },
  linkCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  linkContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  linkText: {
    fontSize: 14,
  },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  linkButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  linkButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  payoutCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  payoutInfo: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  payoutButton: {
    marginTop: Spacing.sm,
  },
  referralsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  referralItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  referralAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  referralDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  codeSection: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  codeLabel: {
    fontSize: 12,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 2,
  },
});
