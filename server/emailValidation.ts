import { promises as dns } from "node:dns";

const DNS_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const domainCache = new Map<string, { deliverable: boolean; expiresAt: number }>();

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

type LookupOutcome = "yes" | "no" | "transient";

async function hasMx(domain: string): Promise<LookupOutcome> {
  try {
    const records = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS, "MX");
    const ok = Array.isArray(records) && records.some((r) => r.exchange && r.exchange.length > 0);
    return ok ? "yes" : "no";
  } catch (err: any) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") return "no";
    if (isTransientDnsError(err)) return "transient";
    return "no";
  }
}

async function hasAddressRecord(domain: string): Promise<LookupOutcome> {
  const v4 = withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS, "A").then(
    (r) => (r && r.length > 0 ? "yes" : "no") as LookupOutcome,
    (err: any) => (isTransientDnsError(err) ? "transient" : "no") as LookupOutcome,
  );
  const v6 = withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS, "AAAA").then(
    (r) => (r && r.length > 0 ? "yes" : "no") as LookupOutcome,
    (err: any) => (isTransientDnsError(err) ? "transient" : "no") as LookupOutcome,
  );
  const [a, aaaa] = await Promise.all([v4, v6]);
  if (a === "yes" || aaaa === "yes") return "yes";
  if (a === "transient" || aaaa === "transient") return "transient";
  return "no";
}

async function isDomainDeliverable(domain: string): Promise<{ deliverable: boolean; cacheable: boolean }> {
  const key = domain.toLowerCase();
  const cached = domainCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { deliverable: cached.deliverable, cacheable: false };
  }

  const mx = await hasMx(key);
  if (mx === "yes") return { deliverable: true, cacheable: true };

  if (mx === "no") {
    const addr = await hasAddressRecord(key);
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
