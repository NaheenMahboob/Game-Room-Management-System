"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export function HomeLinks({
  equipmentCount,
  adminEmail,
  dbError,
}: {
  equipmentCount: number;
  adminEmail: string | null;
  dbError: string | null;
}) {
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

      {dbError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-red-200">
          <p className="font-medium">Database connection failed</p>
          <p className="mt-2 break-words text-sm">{dbError}</p>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-100">
          <p className="font-medium">{t("dbConnected")}</p>
          <p>
            Equipment: <span className="font-mono text-lg">{equipmentCount}</span>
          </p>
          <p>
            Admin: <span className="font-mono">{adminEmail ?? "n/a"}</span>
          </p>
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
