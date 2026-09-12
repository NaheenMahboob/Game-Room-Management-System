/**
 * Supported locales, default locale, and RTL helpers for the UI.
 */

/** Supported UI language codes. */
export const locales = ["en", "ar"] as const;

/** Union of supported locale strings. */
export type Locale = (typeof locales)[number];

/** Locale used when none is stored or requested. */
export const defaultLocale: Locale = "en";

/** Cookie name persisting the user's locale choice. */
export const LOCALE_COOKIE = "grms_locale";

/** Type guard: `true` when `value` is a supported {@link Locale}. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Locales that use right-to-left layout. */
export const rtlLocales: Locale[] = ["ar"];
