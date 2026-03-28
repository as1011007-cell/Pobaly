import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

export function setupNotificationHandlers(
  onNotification?: (notification: Notifications.Notification) => void
): () => void {
  if (Platform.OS === "web") return () => {};
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    onNotification?.(notification);
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener(() => {});
  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
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
      trigger: { seconds: 2 } as Notifications.TimeIntervalTriggerInput,
    });
  } catch (error) {
    console.error("Error sending welcome notification:", error);
  }
}
