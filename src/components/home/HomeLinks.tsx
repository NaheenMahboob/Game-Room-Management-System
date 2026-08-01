"use client";

/**
 * Home navigation card: open/closed badge, today's hours, weekly schedule, and
 * links to the public board, member portal, and staff dashboard.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import type { DayHours, OpeningHoursMap } from "@/lib/settings";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type HomeLinksProps = {
  /** Whether the room is open at the time the page was rendered. */
  isOpen: boolean;
  /** Lowercase weekday key for today (`monday`, …). */
  dayKey: string;
  /** Today's open/close times, if configured. */
  todayHours: DayHours | null;
  /** Full weekly schedule from settings. */
  openingHours: OpeningHoursMap | null;
  /** True when opening hours could not be loaded (typically DB unreachable). */
  hoursUnavailable: boolean;
};

/**
 * Renders the public home landing content.
 *
 * @param props - Open/closed status and schedule plus unavailable flag
 */
export function HomeLinks({
  isOpen,
  dayKey,
  todayHours,
  openingHours,
  hoursUnavailable,
}: HomeLinksProps) {
  const t = useTranslations("app");

  return (
    <div className="w-full max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-slate-400">{t("subtitle")}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {hoursUnavailable ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-red-200">
          {/* Keep this generic — never surface raw DB/driver errors on the public home page. */}
          <p className="font-medium">{t("hoursUnavailable")}</p>
          <p className="mt-2 text-sm">{t("cantReachDatabase")}</p>
        </div>
      ) : (
        <div
          className={`space-y-3 rounded-lg border p-4 ${
            isOpen
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
              : "border-slate-600 bg-slate-900/70 text-slate-200"
          }`}
        >
          <p className="text-2xl font-semibold tracking-tight">
            {isOpen ? t("weAreOpen") : t("weAreClosed")}
          </p>
          {todayHours ? (
            <p className="text-sm">
              {t("todayHours", {
                day: t(`days.${dayKey}`),
                open: todayHours.open,
                close: todayHours.close,
              })}
            </p>
          ) : (
            <p className="text-sm text-slate-400">{t("noHoursToday")}</p>
          )}

          {openingHours ? (
            <div className="border-t border-white/10 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("operatingHours")}
              </p>
              <ul className="space-y-1 text-sm">
                {DAY_ORDER.map((day) => {
                  const hours = openingHours[day];
                  return (
                    <li
                      key={day}
                      className={`flex justify-between gap-3 ${
                        day === dayKey ? "font-semibold text-teal-200" : ""
                      }`}
                    >
                      <span>{t(`days.${day}`)}</span>
                      <span className="tabular-nums text-slate-300">
                        {hours
                          ? `${hours.open} – ${hours.close}`
                          : t("closedDay")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/public"
          className="rounded-lg bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-500"
        >
          {t("publicBoard")}
        </Link>
        <Link
          href="/portal/login"
          className="rounded-lg border border-slate-600 px-4 py-3 text-center text-sm font-semibold hover:bg-slate-800"
        >
          {t("memberPortal")}
        </Link>
        <Link
          href="/dashboard/login"
          className="rounded-lg border border-slate-600 px-4 py-3 text-center text-sm font-semibold hover:bg-slate-800 sm:col-span-2"
        >
          {t("dashboard")}
        </Link>
      </div>
    </div>
  );
}
