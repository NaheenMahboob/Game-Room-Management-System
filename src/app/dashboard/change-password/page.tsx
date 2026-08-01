/**
 * Forced / voluntary password change for volunteers and admins after reset.
 * Middleware redirects here when the JWT has `mustChangePassword`.
 */

import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default function DashboardChangePasswordPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <ChangePasswordForm fallbackRedirect="/dashboard" />
    </main>
  );
}
