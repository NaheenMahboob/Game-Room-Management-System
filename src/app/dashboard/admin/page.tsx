import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AdminHomePage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin</h1>
            <p className="mt-2 text-slate-400">
              Signed in as{" "}
              <span className="font-mono text-emerald-300">{session.email}</span>
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-5 text-sm text-amber-100">
          Inventory, analytics, audit log, and settings will be built in Module
          6. Auth + ADMIN role guard is active.
        </div>

        <Link
          href="/dashboard"
          className="inline-block text-sm text-slate-300 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    </main>
  );
}
