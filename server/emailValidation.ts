import { promises as dns } from "node:dns";

const DNS_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const domainCache = new Map<string, { deliverable: boolean; expiresAt: number }>();

const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
  "mailnesia.com",
  "mohmal.com",
  "maildrop.cc",
  "mailcatch.com",
  "mailbox.org",
  "spambog.com",
  "spamgourmet.com",
  "moakt.com",
  "mailtemp.info",
  "tempr.email",
  "tempinbox.com",
  "fakemail.net",
  "emailondeck.com",
  "anonbox.net",
  "deadaddress.com",
  "throwaway.email",
  "instantemailaddress.com",
  "harakirimail.com",
  "burnermail.io",
  "mytemp.email",
  "qowo.com",
  "gausi.com",
  "jui.com",
  "gma.com",
]);

const INVALID_MX_HOSTS = new Set<string>([
  "",
  ".",
  "localhost",
  "localhost.",
  "0.0.0.0",
  "127.0.0.1",
  "::",
  "::1",
  "0",
]);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms),
    ),
  ]);
}

function isTransientDnsError(err: any): boolean {
  const code = err?.code;
  if (!code) return /TIMEOUT/.test(String(err?.message || ""));
  return code === "ETIMEOUT" || code === "ESERVFAIL" || code === "EREFUSED" || code === "ECONNREFUSED";
}

type MxOutcome = "yes" | "no_records" | "null_mx" | "bogus_mx" | "transient";
type AddrOutcome = "yes" | "no" | "transient";

async function checkMx(domain: string): Promise<MxOutcome> {
  try {
    const records = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS, "MX");
    if (!Array.isArray(records) || records.length === 0) return "no_records";

    const hasNullMx = records.some((r) => {
      const ex = (r.exchange || "").trim().toLowerCase();
      const prio = r.priority;
      return (ex === "" || ex === ".") && (prio === 0 || prio === undefined);
    });
    if (hasNullMx) return "null_mx";

    const validExchanges = records.filter((r) => {
      const ex = (r.exchange || "").trim().toLowerCase().replace(/\.$/, "");
      return ex.length > 0 && !INVALID_MX_HOSTS.has(ex) && ex.includes(".");
    });

    if (validExchanges.length > 0) return "yes";
    return "bogus_mx";
  } catch (err: any) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") return "no_records";
    if (isTransientDnsError(err)) return "transient";
    return "no_records";
  }
}

async function checkAddressRecord(domain: string): Promise<AddrOutcome> {
  const v4 = withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS, "A").then(
    (r) => (r && r.length > 0 ? "yes" : "no") as AddrOutcome,
    (err: any) => (isTransientDnsError(err) ? "transient" : "no") as AddrOutcome,
  );
  const v6 = withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS, "AAAA").then(
    (r) => (r && r.length > 0 ? "yes" : "no") as AddrOutcome,
    (err: any) => (isTransientDnsError(err) ? "transient" : "no") as AddrOutcome,
  );
  const [a, aaaa] = await Promise.all([v4, v6]);
  if (a === "yes" || aaaa === "yes") return "yes";
  if (a === "transient" || aaaa === "transient") return "transient";
  return "no";
}

async function isDomainDeliverable(domain: string): Promise<{ deliverable: boolean; cacheable: boolean }> {
  const key = domain.toLowerCase();

  if (DISPOSABLE_DOMAINS.has(key)) {
    return { deliverable: false, cacheable: true };
  }

  const cached = domainCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { deliverable: cached.deliverable, cacheable: false };
  }

  const mx = await checkMx(key);

  if (mx === "yes") return { deliverable: true, cacheable: true };
  if (mx === "null_mx") return { deliverable: false, cacheable: true };
  if (mx === "bogus_mx") return { deliverable: false, cacheable: true };

  if (mx === "no_records") {
    const addr = await checkAddressRecord(key);
    if (addr === "yes") return { deliverable: true, cacheable: true };
    if (addr === "no") return { deliverable: false, cacheable: true };
    return { deliverable: true, cacheable: false };
  }

  return { deliverable: true, cacheable: false };
}

function toAsciiDomain(domain: string): string | null {
  try {
    const u = new URL(`http://${domain}`);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export interface EmailDeliverabilityResult {
  valid: boolean;
  reason?: string;
}

export async function validateEmailDeliverable(email: string): Promise<EmailDeliverabilityResult> {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return { valid: false, reason: "Please enter a valid email address." };
  }
  const rawDomain = trimmed.slice(at + 1);
  if (!rawDomain || rawDomain.length > 253) {
    return { valid: false, reason: "Please enter a valid email address." };
  }
  const ascii = toAsciiDomain(rawDomain);
  if (!ascii || !ascii.includes(".") || ascii.startsWith(".") || ascii.endsWith(".") || ascii.includes("..")) {
    return { valid: false, reason: "Please enter a valid email address." };
  }

  try {
    const { deliverable, cacheable } = await isDomainDeliverable(ascii);
    if (cacheable) {
      domainCache.set(ascii.toLowerCase(), {
        deliverable,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }
    if (!deliverable) {
      return {
        valid: false,
        reason: "This email doesn't appear to exist. Please use a real email address.",
      };
    }
    return { valid: true };
  } catch {
    return { valid: true };
  }
}
