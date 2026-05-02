/**
 * One-time interactive login to generate a Telegram session string for the
 * Probaly server. Run this in the Replit shell:
 *
 *   npx tsx scripts/telegramLogin.ts
 *
 * It will prompt for your Telegram API ID / API Hash (from
 * https://my.telegram.org), your phone number, the login code Telegram sends
 * to your app, and (if you have it enabled) your 2FA password.
 *
 * The script prints a long session string at the end. Save it as the
 * TELEGRAM_SESSION_STRING secret in Replit, then publish/redeploy. The server
 * will use this session to read your private channel and download new
 * photos/videos for the landing page.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
// @ts-ignore — `input` is a tiny prompt lib without bundled types
import input from "input";

(async () => {
  console.log("=== Probaly Telegram Login ===");
  console.log(
    "This generates a session string so the server can read your private Telegram channel.",
  );
  console.log("Get your API ID and API Hash at https://my.telegram.org first.");
  console.log("");

  const apiIdStr =
    process.env.TELEGRAM_API_ID ||
    (await (input as any).text("API ID (numeric, from my.telegram.org): "));
  const apiHash =
    process.env.TELEGRAM_API_HASH ||
    (await (input as any).text("API Hash (from my.telegram.org): "));
  const apiId = parseInt(apiIdStr as string, 10);

  if (!apiId || !apiHash) {
    console.error("API ID or API Hash missing — aborting.");
    process.exit(1);
  }

  const session = new StringSession("");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () =>
      (await (input as any).text(
        "Phone number with country code (e.g. +15551234567): ",
      )) as string,
    password: async () =>
      (await (input as any).password(
        "2FA password (press Enter if you don't have one): ",
      )) as string,
    phoneCode: async () =>
      (await (input as any).text(
        "Login code Telegram sent to your app: ",
      )) as string,
    onError: (err) => {
      console.error("Login error:", err?.message || err);
    },
  });

  const sessionString = client.session.save() as unknown as string;
  console.log("");
  console.log("==================================================");
  console.log("Login successful. Your TELEGRAM_SESSION_STRING is:");
  console.log("==================================================");
  console.log("");
  console.log(sessionString);
  console.log("");
  console.log("==================================================");
  console.log(
    "Save this value as the TELEGRAM_SESSION_STRING secret in Replit, then redeploy.",
  );
  console.log("Keep it private — anyone with it can read your Telegram account.");
  console.log("==================================================");

  await client.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("Login script failed:", err?.message || err);
  process.exit(1);
});
