import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const PROMO_SCHEDULED_KEY = "@probaly/promo_notifications_scheduled";
const SIX_HOURS = 6 * 60 * 60;

const PREMIUM_PROMO_MESSAGES = [
  {
    title: "Unlock Winning Predictions",
    body: "Premium members get access to 40+ daily AI predictions across 8 sports. Upgrade now and start winning!",
  },
  {
    title: "You're Missing Out",
    body: "Free users only see 1 prediction per day. Premium unlocks them all — basketball, baseball, hockey and more.",
  },
  {
    title: "AI-Powered Edge",
    body: "Our AI analyzes thousands of data points for every game. Go Premium to see every prediction with full analysis.",
  },
  {
    title: "See What the Pros See",
    body: "Premium includes sportsbook consensus odds from DraftKings, FanDuel, BetMGM and more. Upgrade today!",
  },
  {
    title: "Don't Miss Today's Picks",
    body: "Multiple high-confidence predictions are waiting for you. Go Premium to unlock all of today's tips.",
  },
  {
    title: "Your Winning Streak Starts Here",
    body: "Premium members track their prediction history and see their win rate. Upgrade to access your full stats.",
  },
  {
    title: "Limited Time Value",
    body: "Get Premium for less than $1/day and access every AI prediction, every sport, every game. Try it now!",
  },
  {
    title: "Beat the Odds",
    body: "Our AI predictions come with probability scores, confidence levels, and risk analysis. Unlock everything with Premium.",
  },
];

export function setupNotificationHandlers(
  onNotification?: (notification: Notifications.Notification) => void
): () => void {
  if (Platform.OS === "web") return () => {};

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    } as any),
  });

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("predictions", {
      name: "Predictions",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
    Notifications.setNotificationChannelAsync("promotions", {
      name: "Premium Offers",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    onNotification?.(notification);
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener(() => {});

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return status === "granted";
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
}

export async function registerPushTokenWithServer(authToken: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    const pushToken = tokenData.data;

    if (!pushToken) return null;

    const url = new URL("/api/push-token", getApiUrl());
    await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token: pushToken,
        platform: Platform.OS,
      }),
    });

    console.log("Push token registered:", pushToken.substring(0, 30) + "...");
    return pushToken;
  } catch (error) {
    console.error("Error registering push token:", error);
    return null;
  }
}

export async function unregisterPushToken(authToken: string, pushToken: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const url = new URL("/api/push-token", getApiUrl());
    await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });
  } catch (error) {
    console.error("Error unregistering push token:", error);
  }
}

export async function sendWelcomeNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Welcome to Probaly",
        body: "Get the best sports analysis from Probaly",
        badge: 1,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
    });
  } catch (error) {
    console.error("Error sending welcome notification:", error);
  }
}

export async function schedulePremiumPromoNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const alreadyScheduled = await AsyncStorage.getItem(PROMO_SCHEDULED_KEY);
    if (alreadyScheduled) return;

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    for (let i = 0; i < PREMIUM_PROMO_MESSAGES.length; i++) {
      const msg = PREMIUM_PROMO_MESSAGES[i];
      const delaySeconds = SIX_HOURS * (i + 1);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          data: { type: "premium_promo", screen: "Subscription" },
          sound: "default",
          ...(Platform.OS === "android" ? { channelId: "promotions" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
        },
      });
    }

    await AsyncStorage.setItem(PROMO_SCHEDULED_KEY, new Date().toISOString());
    console.log(`Scheduled ${PREMIUM_PROMO_MESSAGES.length} premium promo notifications (every 6hrs)`);
  } catch (error) {
    console.error("Error scheduling premium promo notifications:", error);
  }
}

export async function cancelPremiumPromoNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.type === "premium_promo") {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
    await AsyncStorage.removeItem(PROMO_SCHEDULED_KEY);
    console.log("Cancelled all premium promo notifications");
  } catch (error) {
    console.error("Error cancelling premium promo notifications:", error);
  }
}

export async function resetPromoScheduleFlag(): Promise<void> {
  await AsyncStorage.removeItem(PROMO_SCHEDULED_KEY);
}
