import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function requestNotificationPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    return status === "granted";
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
}

export function setupNotificationHandlers(onNotification?: (notification: Notifications.Notification) => void) {
  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Handle notifications when app is foregrounded
  const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log("Notification received:", notification);
    onNotification?.(notification);
  });

  // Handle notification taps
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log("Notification tapped:", response.notification);
  });

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

export async function sendTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Welcome to Probaly",
        body: "Get the best sports analysis from Probaly",
        badge: 1,
      },
      trigger: { seconds: 2 }, // Send in 2 seconds
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
  }
}
