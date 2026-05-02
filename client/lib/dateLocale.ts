import { enUS, es, fr, de, ja, zhCN, ru } from "date-fns/locale";
import type { Locale } from "date-fns";
import type { Language } from "./translations";

const LOCALE_MAP: Record<Language, Locale> = {
  en: enUS,
  es,
  fr,
  de,
  ja,
  zh: zhCN,
  ru,
};

export function getDateLocale(language: Language): Locale {
  return LOCALE_MAP[language] || enUS;
}
