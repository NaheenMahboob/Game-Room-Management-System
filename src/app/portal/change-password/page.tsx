/**
 * Forced / voluntary password change for members after admin reset.
 * Middleware redirects here when the JWT has `mustChangePassword`.
 */

import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export default function PortalChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <ChangePasswordForm fallbackRedirect="/portal" />
    </main>
  );
}
