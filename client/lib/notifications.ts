import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApiUrl } from "@/lib/query-client";

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
