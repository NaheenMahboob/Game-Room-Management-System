"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useLocaleState } from "@/components/i18n/I18nProvider";
import { rtlLocales } from "@/i18n/config";

type Availability = {
  type: string;
  label?: string;
  total: number;
  available: number;
  inUse: number;
  good: number;
  minorIssue: number;
  outOfOrder: number;
};

type Board = {
  occupancy: {
    membersInside: number;
    guestsInside: number;
    totalInside: number;
  };
  availability: Availability[];
  openingHours: Record<string, { open: string; close: string }> | null;
  communityRules: string;
  membershipInfo: string;
  announcements: { id: string; title: string; content: string }[];
  events: {
    id: string;
    title: string;
    description: string;
    eventDate: string;
  }[];
  refreshedAt: string;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function PublicBoardClient() {
  const t = useTranslations("board");
  const { locale } = useLocaleState();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/public/board", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load board");
      setBoard(data.board);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 12000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div
      className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f766e_0%,_#020617_45%,_#020617_100%)] text-slate-50"
      dir={rtlLocales.includes(locale) ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col px-6 py-5 lg:px-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-teal-200/80">
              {t("mosque")}
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight lg:text-6xl">
              {t("brand")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/portal/login"
              className="min-h-12 rounded-xl border border-white/15 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-teal-100"
            >
              {t("memberLogin")}
            </Link>
          </div>
        </header>

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-red-100">
            {error}
          </p>
        ) : null}

        <section className="mb-8 rounded-3xl border border-teal-400/20 bg-slate-950/50 px-6 py-8 text-center shadow-[0_0_60px_rgba(13,148,136,0.15)]">
          <p className="text-8xl font-black tabular-nums text-teal-300 lg:text-[9rem]">
            {board?.occupancy.totalInside ?? "—"}
          </p>
          <p className="mt-2 text-2xl text-slate-200 lg:text-3xl">{t("inside")}</p>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(board?.availability ?? []).map((item) => (
            <div
              key={item.type}
              className="rounded-2xl border border-white/10 bg-slate-950/55 p-5"
            >
              <p className="text-lg font-semibold lg:text-xl">
                {item.label ?? item.type}
              </p>
              <p className="mt-3 text-4xl font-bold text-emerald-400">
                {item.available}
                <span className="text-xl text-slate-400"> / {item.total}</span>
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p className="text-emerald-300">
                  {t("available")}: {item.available}
                </p>
                <p className="text-amber-300">
                  {t("inUse")}: {item.inUse} · {t("minor")}: {item.minorIssue}
                </p>
                <p className="text-red-300">
                  {t("out")}: {item.outOfOrder}
                </p>
              </div>
            </div>
          ))}
        </section>

        <div className="grid flex-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
            <h2 className="mb-4 text-2xl font-semibold">{t("hours")}</h2>
            <ul className="space-y-2 text-lg">
              {DAY_ORDER.map((day) => {
                const hours = board?.openingHours?.[day];
                return (
                  <li
                    key={day}
                    className="flex justify-between gap-3 border-b border-white/5 py-1 capitalize"
                  >
                    <span>{day}</span>
                    <span className="tabular-nums text-teal-200">
                      {hours ? `${hours.open} – ${hours.close}` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 lg:col-span-2">
            <h2 className="mb-4 text-2xl font-semibold">{t("announcements")}</h2>
            <div className="space-y-4">
              {(board?.announcements ?? []).length === 0 ? (
                <p className="text-slate-400">{t("noAnnouncements")}</p>
              ) : (
                board?.announcements.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-xl border border-teal-500/20 bg-teal-950/20 p-4"
                  >
                    <h3 className="text-xl font-semibold text-teal-100">
                      {a.title}
                    </h3>
                    <p className="mt-2 text-slate-200">{a.content}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
            <h2 className="mb-4 text-2xl font-semibold">{t("events")}</h2>
            <ul className="space-y-3">
              {(board?.events ?? []).map((event) => (
                <li key={event.id} className="rounded-xl bg-slate-900/70 p-3">
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-sm text-teal-200">
                    {new Date(event.eventDate).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {event.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
            <h2 className="mb-4 text-2xl font-semibold">{t("rules")}</h2>
            <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed text-slate-200">
              {board?.communityRules}
            </pre>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
            <h2 className="mb-4 text-2xl font-semibold">{t("join")}</h2>
            <p className="text-lg leading-relaxed text-slate-200">
              {board?.membershipInfo}
            </p>
          </section>
        </div>

        <footer className="mt-6 flex justify-between text-sm text-slate-400">
          <span>
            {t("updated")}:{" "}
            {board ? new Date(board.refreshedAt).toLocaleTimeString() : "—"}
          </span>
          <Link href="/" className="hover:text-teal-200">
            Home
          </Link>
        </footer>
      </div>
    </div>
  );
}
