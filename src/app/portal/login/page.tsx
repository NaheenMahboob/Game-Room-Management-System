import { LoginForm } from "@/components/auth/LoginForm";

export default function PortalLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <LoginForm
        portal="member"
        title="Member portal"
        subtitle="Sign in with your member email and password."
        redirectTo="/portal"
      />
    </main>
  );
}
