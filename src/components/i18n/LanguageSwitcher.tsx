"use client";

import { useLocaleState } from "@/components/i18n/I18nProvider";
import { locales, type Locale } from "@/i18n/config";
import { useTranslations } from "next-intl";

const LABELS: Record<Locale, string> = {
  en: "EN",
  ar: "عربي",
  ur: "اردو",
};

export function LanguageSwitcher() {
  const t = useTranslations("app");
  const { locale, setLocale } = useLocaleState();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/70 p-1"
      aria-label={t("language")}
    >
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${
            locale === code
              ? "bg-teal-600 text-white"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
