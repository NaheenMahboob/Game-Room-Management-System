"use client";

/**
 * Shared change-password form for portal and dashboard.
 * Used after admin password reset for members, volunteers, and admins.
 *
 * @author Muhammad Naheen Mahboob
 */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/auth/PasswordField";

/**
 * Props for {@link ChangePasswordForm}.
 *
 * @author Muhammad Naheen Mahboob
 */
type ChangePasswordFormProps = {
  /** Where to send the user after a successful change (fallback if API omits redirect). */
  fallbackRedirect: string;
};

/**
 * Collects current + new password and posts to `/api/auth/change-password`.
 *
 * @author Muhammad Naheen Mahboob
 */
export function ChangePasswordForm({
  fallbackRedirect,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Validates match/length client-side, then persists the new password.
   *
   * @author Muhammad Naheen Mahboob
   */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Cheap client checks before hitting the API (API still enforces).
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not change password");
        return;
      }
      // API may send role-specific landing; otherwise use the page's fallback.
      router.push(data.redirectTo ?? fallbackRedirect);
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900/80 p-8 shadow-xl">
      <h1 className="text-2xl font-semibold text-slate-50">
        Set a new password
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Your account requires a password update before you can continue. Use
        the temporary password from your admin if you were reset, then choose a
        new one.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          minLength={8}
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={8}
        />
        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
