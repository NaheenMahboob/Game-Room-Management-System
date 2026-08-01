"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { ConnectionStatus } from "@/components/offline/ConnectionStatus";

export function DashboardNav({
  email,
  role,
}: {
  email: string;
  role: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  if (pathname === "/dashboard/login") return null;

  const NAV = [
    { href: "/dashboard", label: t("home") },
    { href: "/dashboard/members", label: t("members") },
    { href: "/dashboard/borrow", label: t("borrow") },
    { href: "/dashboard/return", label: t("return") },
    { href: "/dashboard/attendance", label: t("inside") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Game Room Kiosk</p>
          <p className="text-xs text-slate-400">
            {email} · {role}
          </p>
          <div className="mt-2">
            <ConnectionStatus />
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-h-12 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {role === "ADMIN" ? (
            <Link
              href="/dashboard/admin"
              className="min-h-12 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-amber-300 hover:bg-slate-700"
            >
              {t("admin")}
            </Link>
          ) : null}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
