import { LoginForm } from "@/components/auth/LoginForm";

export default function DashboardLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <LoginForm
        portal="dashboard"
        title="Volunteer / Admin dashboard"
        subtitle="Sign in to manage attendance, equipment, and the game room."
        redirectTo="/dashboard"
      />
    </main>
  );
}
