import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";

// Supported language codes the client can request via ?lang=. Source language
// is English; "en" passes through untouched. Any other value not in this set
// is rejected and treated as English.
export const SUPPORTED_LANGUAGES = [
  "en",
  "es",
  "fr",
  "de",
  "ja",
  "zh",
  "ru",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
  ru: "Russian",
};

export function normalizeLang(value: unknown): SupportedLanguage {
  if (typeof value !== "string") return "en";
  const v = value.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(v)
    ? (v as SupportedLanguage)
    : "en";
}

// Lazy Groq client — same pattern as predictionService.ts. We do NOT share
// the client instance across modules so each service can manage its own
// retry/error semantics independently.
let _groq: OpenAI | null = null;
function getGroq(): OpenAI {
  if (!_groq) {
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _groq;
}
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface TranslatableFactor {
  title?: string;
  description?: string;
  impact?: string;
}

export interface TranslatablePrediction {
  id: number;
  predictedOutcome?: string | null;
  explanation?: string | null;
  factors?: TranslatableFactor[] | null;
  // Anything else (matchTitle, sport, probability, etc.) passes through.
  [key: string]: any;
}

interface CachedTranslation {
  predictedOutcome: string | null;
  explanation: string | null;
  factors: TranslatableFactor[] | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Cache table bootstrap (raw SQL — same pattern as telegram_media). We
// don't touch shared/schema, so this lives entirely outside Drizzle's typed
// surface. Primary key (prediction_id, language) means each (pick, lang)
// pair is translated at most once over the prediction's lifetime.
// ──────────────────────────────────────────────────────────────────────────
export async function initTranslationCache(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS prediction_translations (
      prediction_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      predicted_outcome TEXT,
      explanation TEXT,
      factors JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (prediction_id, language)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_prediction_translations_lang
    ON prediction_translations(language)
  `);
  console.log("[i18n] translation cache table ready");
}

async function loadCached(
  ids: number[],
  lang: SupportedLanguage,
): Promise<Map<number, CachedTranslation>> {
  const out = new Map<number, CachedTranslation>();
  if (ids.length === 0) return out;
  const rows: any = await db.execute(sql`
    SELECT prediction_id, predicted_outcome, explanation, factors
    FROM prediction_translations
    WHERE language = ${lang}
      AND prediction_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `);
  const list: any[] = Array.isArray(rows) ? rows : rows?.rows ?? [];
  for (const r of list) {
    out.set(Number(r.prediction_id), {
      predictedOutcome: r.predicted_outcome ?? null,
      explanation: r.explanation ?? null,
      factors: Array.isArray(r.factors) ? r.factors : null,
    });
  }
  return out;
}

async function storeCached(
  predictionId: number,
  lang: SupportedLanguage,
  data: CachedTranslation,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO prediction_translations
        (prediction_id, language, predicted_outcome, explanation, factors)
      VALUES (
        ${predictionId},
        ${lang},
        ${data.predictedOutcome},
        ${data.explanation},
        ${JSON.stringify(data.factors ?? [])}::jsonb
      )
      ON CONFLICT (prediction_id, language) DO UPDATE SET
        predicted_outcome = EXCLUDED.predicted_outcome,
        explanation = EXCLUDED.explanation,
        factors = EXCLUDED.factors,
        created_at = NOW()
    `);
  } catch (e) {
    console.warn("[i18n] cache write failed:", (e as Error).message);
  }
}

// Build the Groq prompt. We send a compact JSON envelope — the LLM returns
// the same shape with translated fields. Proper nouns (team/player/place
// names, league names, score numbers like "Over 8.5") MUST stay verbatim
// or the translated text loses meaning.
function buildTranslationPrompt(
  items: { id: number; predictedOutcome: string; explanation: string; factors: TranslatableFactor[] }[],
  langName: string,
): string {
  return `You are a professional sports-betting copy translator.

Translate the user-facing copy of each prediction below into ${langName}.

CRITICAL RULES:
- KEEP team names, player names, city names, league names, and competition names EXACTLY as written (they are proper nouns).
- KEEP all numbers, scores, percentages, and odds notation untouched (e.g. "Over 8.5", "67%", "+1.5").
- KEEP the words "Over" and "Under" untouched when they precede a number — these are betting market labels and must stay in English so the bet remains identifiable.
- Translate everything else (explanation prose, factor titles, factor descriptions, and any non-numeric portion of predictedOutcome) into natural, idiomatic ${langName} as a sports analyst would write it.
- Preserve the array order, the same number of factors, and the impact field unchanged ("positive" / "negative" / "neutral" — these are machine values, do NOT translate).
- Return ONLY a JSON object — no markdown, no commentary.

Output JSON shape:
{"items":[{"id":<number>,"predictedOutcome":"...","explanation":"...","factors":[{"title":"...","description":"...","impact":"positive|negative|neutral"}]}]}

Input items:
${JSON.stringify({ items })}`;
}

async function translateBatch(
  items: { id: number; predictedOutcome: string; explanation: string; factors: TranslatableFactor[] }[],
  lang: SupportedLanguage,
): Promise<Map<number, CachedTranslation>> {
  const result = new Map<number, CachedTranslation>();
  if (items.length === 0) return result;

  const prompt = buildTranslationPrompt(items, LANGUAGE_NAMES[lang]);
  let raw = "";
  try {
    const resp = await getGroq().chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: Math.min(4500, items.length * 600),
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    raw = resp.choices[0]?.message?.content || "";
  } catch (e) {
    console.warn(
      `[i18n] Groq translate batch failed (${items.length} items, lang=${lang}):`,
      (e as Error).message,
    );
    return result;
  }

  let parsed: { items?: any[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
  }

  const list = Array.isArray(parsed.items) ? parsed.items : [];
  for (const r of list) {
    const id = Number(r?.id);
    if (!Number.isInteger(id)) continue;
    const factors: TranslatableFactor[] = Array.isArray(r.factors)
      ? r.factors.map((f: any) => ({
          title: typeof f?.title === "string" ? f.title : "",
          description: typeof f?.description === "string" ? f.description : "",
          impact: ["positive", "negative", "neutral"].includes(f?.impact) ? f.impact : "neutral",
        }))
      : [];
    result.set(id, {
      predictedOutcome: typeof r.predictedOutcome === "string" ? r.predictedOutcome : null,
      explanation: typeof r.explanation === "string" ? r.explanation : null,
      factors,
    });
  }
  return result;
}

function applyTranslation<T extends TranslatablePrediction>(
  prediction: T,
  t: CachedTranslation,
): T {
  return {
    ...prediction,
    predictedOutcome: t.predictedOutcome ?? prediction.predictedOutcome ?? "",
    explanation: t.explanation ?? prediction.explanation ?? "",
    factors: Array.isArray(t.factors) && t.factors.length > 0 ? t.factors : prediction.factors ?? [],
  };
}

const TRANSLATE_BATCH_SIZE = 8;

/**
 * Translate an array of predictions into the requested language.
 * - lang === "en"        → returns predictions unchanged
 * - cached translations  → applied from `prediction_translations`
 * - cache misses         → Groq-translated in batches of 8, then cached
 *
 * Failures fall back to the original (English) text so the user always sees
 * a usable response — better stale than blank.
 */
export async function translatePredictions<T extends TranslatablePrediction>(
  preds: T[],
  lang: SupportedLanguage,
): Promise<T[]> {
  if (lang === "en" || preds.length === 0) return preds;

  const validIds = preds
    .map((p) => Number(p.id))
    .filter((id) => Number.isInteger(id));
  const cached = await loadCached(validIds, lang);

  // Identify which predictions still need translation.
  const missing = preds.filter((p) => {
    const id = Number(p.id);
    if (!Number.isInteger(id)) return false;
    if (cached.has(id)) return false;
    // Skip predictions with no translatable text (defensive — should not happen).
    return Boolean((p.explanation && p.explanation.trim()) || (p.predictedOutcome && p.predictedOutcome.trim()));
  });

  if (missing.length > 0) {
    for (let i = 0; i < missing.length; i += TRANSLATE_BATCH_SIZE) {
      const batch = missing.slice(i, i + TRANSLATE_BATCH_SIZE).map((p) => ({
        id: Number(p.id),
        predictedOutcome: String(p.predictedOutcome ?? ""),
        explanation: String(p.explanation ?? ""),
        factors: Array.isArray(p.factors) ? (p.factors as TranslatableFactor[]) : [],
      }));
      const translated = await translateBatch(batch, lang);
      // Persist + merge into the in-memory cache for this request.
      await Promise.all(
        Array.from(translated.entries()).map(([id, data]) =>
          storeCached(id, lang, data).then(() => cached.set(id, data)),
        ),
      );
    }
  }

  return preds.map((p) => {
    const id = Number(p.id);
    const t = Number.isInteger(id) ? cached.get(id) : undefined;
    return t ? applyTranslation(p, t) : p;
  });
}

/** Convenience wrapper for endpoints that return a single prediction (or null). */
export async function translatePrediction<T extends TranslatablePrediction>(
  pred: T | null | undefined,
  lang: SupportedLanguage,
): Promise<T | null | undefined> {
  if (!pred) return pred;
  const [out] = await translatePredictions([pred], lang);
  return out;
}
