// Firebase Analytics — Google Ads conversion tracking
//
// Tracked automatically by the native Firebase SDK (no extra code needed):
//   • first_open  — first time the app is launched after install
//   • app_install — recorded when the user installs the app
//
// These events are imported into Google Ads to measure install conversions.
//
// In Expo Go development the native SDK is unavailable; all calls are
// silent no-ops so development is unaffected.
// In EAS production builds (App Store / Play Store) the full native SDK runs.

type FirebaseAnalytics = {
  logEvent: (event: string, params?: Record<string, any>) => Promise<void>;
  setUserProperty: (name: string, value: string | null) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
};

let _analytics: FirebaseAnalytics | null | undefined = undefined;

async function getAnalytics(): Promise<FirebaseAnalytics | null> {
  if (_analytics !== undefined) return _analytics;
  try {
    const mod = await import('@react-native-firebase/analytics');
    _analytics = (mod.default as any)();
    return _analytics;
  } catch {
    _analytics = null;
    return null;
  }
}

export async function logFirebaseEvent(
  eventName: string,
  params?: Record<string, any>,
) {
  try {
    const analytics = await getAnalytics();
    if (!analytics) return;
    await analytics.logEvent(eventName, params);
  } catch {}
}

export async function setFirebaseUserId(userId: string | null) {
  try {
    const analytics = await getAnalytics();
    if (!analytics) return;
    await analytics.setUserId(userId);
  } catch {}
}

export async function setFirebaseUserProperty(name: string, value: string | null) {
  try {
    const analytics = await getAnalytics();
    if (!analytics) return;
    await analytics.setUserProperty(name, value);
  } catch {}
}
