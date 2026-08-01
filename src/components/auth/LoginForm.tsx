"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

type Portal = "member" | "dashboard";

type LoginFormProps = {
  portal: Portal;
  title: string;
  subtitle: string;
  redirectTo: string;
};

/**
 * Email/password login. Redirects to change-password when the account was
 * flagged for reset (members, volunteers, and admins).
 */
export function LoginForm({
  portal,
  title,
  subtitle,
  redirectTo,
}: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal }),
      });

      const data = (await response.json()) as {
        error?: string;
        user?: { mustChangePassword?: boolean; role?: string };
      };

      if (!response.ok) {
        setError(data.error ?? "Login failed");
        return;
      }

      if (data.user?.mustChangePassword) {
        const dest =
          portal === "member"
            ? "/portal/change-password"
            : "/dashboard/change-password";
        router.push(dest);
        router.refresh();
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-8 shadow-xl">
      <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-300">{t("email")}</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-300">
            {t("password")}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none ring-emerald-500/40 focus:ring-2"
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      {portal === "member" ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          New here?{" "}
          <Link
            href="/portal/register"
            className="font-semibold text-emerald-400 hover:underline"
          >
            Register as a member
          </Link>
        </p>
      ) : null}
    </div>
  );
}
