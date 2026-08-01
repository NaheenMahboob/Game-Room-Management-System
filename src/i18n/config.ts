/**
 * Supported locales, default locale, and RTL helpers for the UI.
 */

export const locales = ["en", "ar", "ur"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "grms_locale";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const rtlLocales: Locale[] = ["ar", "ur"];
