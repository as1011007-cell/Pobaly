# EAS Update Bootstrap Submission — Handoff

**Why this document exists:** the price-loading delay your users see when opening the app cannot be fixed by any backend change — it's caused by Apple's StoreKit being slow on cold start, which only the JavaScript bundle on the device can mitigate. The fix (cache the last-known price, show it instantly, refresh in the background) is already written in `client/lib/revenuecat.tsx` and `client/screens/SubscriptionScreen.tsx`.

For that fix to reach live App Store users, you need ONE final classic submission that:
1. Carries the price-loading fix itself (instant relief for users on the new build)
2. Includes the `expo-updates` native module (which I just added)

After this submission, every future JS-only change ships instantly via `eas update` — no Apple review, no waiting.

---

## What I already did in this repo

- Installed `expo-updates@~29.0.17` (added to `package.json`)
- Bumped app version: `1.0.2` → `1.0.3`
- Bumped iOS `buildNumber`: `11` → `12` (note: `eas.json` has `appVersionSource: "remote"` and `production.autoIncrement: true`, so EAS may bump this further to whatever the next remote counter is — the actual build number could be 12, 13, or higher; this is fine and does not affect OTA targeting)
- Bumped Android `versionCode`: `11` → `12` (same caveat — EAS may auto-increment further)
- Verified the price-loading fix is wired correctly:
  - `initializeRevenueCat()` prefetches offerings on app launch
  - `getCachedPrices()` reads from AsyncStorage
  - `formatStrikePrice()` falls back to cached price when fresh one isn't loaded yet
  - `SubscriptionScreen.tsx` uses both fresh and cached values

---

## What you need to run (requires YOUR Expo + Apple credentials)

These commands need to run in YOUR local terminal or in Replit's shell with your Expo account logged in. I cannot run them for you because they require interactive auth.

### Step 1: Log into Expo (one-time)
```bash
npx eas-cli login
```
Use your Expo account credentials. If you don't have one yet, create it at https://expo.dev — free for personal projects.

### Step 2: Configure EAS Update for this project
```bash
npx eas-cli update:configure
```
This automatically:
- Adds `updates.url` to `app.json` (something like `https://u.expo.dev/<project-id>`)
- Adds `extra.eas.projectId` to `app.json`
- Confirms `runtimeVersion` policy (already set to `appVersion` — perfect)

**Verify before continuing:** open `app.json` and confirm both of these now exist:
```json
"updates": { "url": "https://u.expo.dev/<some-uuid>", "fallbackToCacheTimeout": 0 }
```
and inside `expo`:
```json
"extra": { "eas": { "projectId": "<some-uuid>" } }
```
If either is missing, the build will compile but won't know where to fetch updates from. Re-run Step 2.

Commit the changes it makes to `app.json`.

### Step 2b: Fix the `eas.json` submit profile (REQUIRED before Step 4)
The current `eas.json` has placeholder values that will make `eas submit` fail. Open `eas.json` and replace these:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "YOUR_APPLE_ID@email.com",         ← your real Apple ID email
      "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",  ← from App Store Connect (Apps → Probaly → App Information → Apple ID, a 10-digit number)
      "appleTeamId": "YOUR_APPLE_TEAM_ID"           ← from developer.apple.com → Membership (10-character team ID)
    },
    "android": {
      "serviceAccountKeyPath": "./google-service-account.json",  ← path to your Play Console service account JSON; download from Google Play Console → Setup → API access → create + download key. The file must exist at this path or the submit will fail.
      "track": "internal",
      "releaseStatus": "completed"
    }
  }
}
```

If you don't want to commit credentials, you can instead run `npx eas-cli submit --platform ios` interactively without filling these in — EAS will prompt you for each value. For Android you still need the service account JSON file present locally; you can `.gitignore` it.

### Step 3: Build the new native binary
```bash
# iOS (TestFlight + App Store)
npx eas-cli build --platform ios --profile production

# Android (Play Store)
npx eas-cli build --platform android --profile production
```
Each build takes ~15-30 minutes on Expo's servers. You'll get download URLs for the resulting `.ipa` and `.aab` files.

### Step 4: Submit to the stores
```bash
# iOS
npx eas-cli submit --platform ios

# Android
npx eas-cli submit --platform android
```
This uploads to App Store Connect and Google Play Console respectively. Apple review typically takes 24-48h. Google review is usually faster.

### Step 5 (anytime after the new build is live): push JS-only updates instantly
Once users have updated to the new build (build 12 or whatever EAS auto-incremented to), any future change to JS/TS code (not native config) can be deployed in seconds:

```bash
npx eas-cli update --channel production --message "Brief description of the change"
```

That's it. No Apple review. No build wait. Users get the update the next time they open the app (or instantly if they're already in it, depending on your update strategy).

---

## What WON'T work via OTA (requires another classic submission)

- Adding/removing native modules (e.g. installing a new package that has native code)
- Changing app icon, splash screen, name, bundle identifier
- Changing iOS Info.plist entries (permissions, capabilities, etc.)
- Changing Android `permissions` or manifest entries
- Updating React Native or Expo SDK to a new major version
- Changing the `runtimeVersion` (this intentionally invalidates OTA targeting)

Anything that's pure JS/TS — UI tweaks, copy changes, bug fixes in business logic, server URL changes, new screens — ships via `eas update`.

---

## Verifying the new build will pick up OTA updates

After Step 2 completes, `app.json` will have:
```json
"runtimeVersion": { "policy": "appVersion" },
"updates": {
  "url": "https://u.expo.dev/<your-project-id>",
  "fallbackToCacheTimeout": 0
}
```

The new build (1.0.3 / build 12+) will compile with the `expo-updates` native module included (because it's in `package.json` now) and will phone home to that `updates.url` on every cold start. When you publish via `eas update --channel production`, the EAS service serves the new JS bundle to any device whose `runtimeVersion` matches (= app version `1.0.3`). Note: targeting is by `runtimeVersion` (= `appVersion` policy), not by build number — so when you next bump to `1.0.4` for another classic submission, you'll need to publish a new OTA update against runtime `1.0.4` to reach those users.

If you ever need to push to BOTH old and new builds simultaneously, change `runtimeVersion.policy` to `"sdkVersion"` — that targets every build with the same Expo SDK regardless of app version. But "appVersion" is the safer default.
