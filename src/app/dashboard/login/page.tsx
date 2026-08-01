"use client";

import { useTranslations } from "next-intl";
import { LoginForm } from "@/components/auth/LoginForm";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export default function DashboardLoginPage() {
  const t = useTranslations("auth");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4">
      <LanguageSwitcher />
      <LoginForm
        portal="dashboard"
        title={t("dashboardTitle")}
        subtitle={t("dashboardSubtitle")}
        redirectTo="/dashboard"
      />
    </main>
  );
}
