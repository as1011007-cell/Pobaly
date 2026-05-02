import nodemailer, { Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;
let cachedConfigKey: string | null = null;

function getConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !port || !user || !pass) {
    return null;
  }
  return { host, port: Number(port), user, pass, from: from! };
}

function getTransporter(): Transporter | null {
  const cfg = getConfig();
  if (!cfg) return null;
  const key = `${cfg.host}|${cfg.port}|${cfg.user}`;
  if (cachedTransporter && cachedConfigKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  cachedConfigKey = key;
  return cachedTransporter;
}

export function isEmailConfigured(): boolean {
  return getConfig() !== null;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
  userName?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const transporter = getTransporter();
  const cfg = getConfig();
  if (!transporter || !cfg) {
    // SECURITY: never log the reset URL itself — it contains a single-use
    // token that grants account takeover within the TTL window. We only log
    // that an attempt was made; the token simply expires unused if SMTP is
    // misconfigured. Operators must configure SMTP_* secrets to enable the
    // feature.
    console.warn(`[email] SMTP not configured — password reset email NOT sent to ${toEmail}.`);
    return { ok: false, reason: "smtp_not_configured" };
  }

  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const subject = "Reset your Probaly password";
  const text = [
    userName ? `Hi ${userName},` : "Hi,",
    "",
    "We received a request to reset the password on your Probaly account.",
    "Open the link below to choose a new password. The link expires in 1 hour and can be used once.",
    "",
    resetUrl,
    "",
    "If you did not request this, you can safely ignore this email — your password will not change.",
    "",
    "— The Probaly Team",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1F2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
        <tr><td style="background:#1A237E;padding:24px 32px;">
          <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.3px;">Probaly</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1A237E;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;">We received a request to reset the password on your Probaly account. Tap the button below to choose a new one. This link expires in <strong>1 hour</strong> and can be used once.</p>
          <p style="margin:0 0 28px;text-align:center;">
            <a href="${escapeAttr(resetUrl)}" style="display:inline-block;background:#E53935;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:8px;font-size:15px;">Reset Password</a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;color:#6B7280;">If the button doesn't work, copy and paste this URL into your browser:</p>
          <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${escapeAttr(resetUrl)}" style="color:#1A237E;">${escapeHtml(resetUrl)}</a></p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
          <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.55;">If you did not request this, you can safely ignore this email — your password will not change.</p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:18px 32px;text-align:center;font-size:12px;color:#9CA3AF;">
          © Probaly · AI-powered sports predictions
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    await transporter.sendMail({
      from: cfg.from,
      to: toEmail,
      subject,
      text,
      html,
    });
    console.log(`[email] password reset sent to ${toEmail}`);
    return { ok: true };
  } catch (err: any) {
    console.error(`[email] failed to send password reset to ${toEmail}:`, err?.message || err);
    return { ok: false, reason: "send_failed" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
