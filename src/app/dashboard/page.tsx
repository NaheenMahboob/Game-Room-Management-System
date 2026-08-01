import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function DashboardHomePage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "VOLUNTEER" && session.role !== "ADMIN")
  ) {
    redirect("/dashboard/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Volunteer dashboard</h1>
            <p className="mt-2 text-slate-400">
              Signed in as{" "}
              <span className="font-mono text-emerald-300">{session.email}</span>{" "}
              · role{" "}
              <span className="font-mono text-amber-300">{session.role}</span>
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-lg font-medium">
            Borrow Equipment
            <p className="mt-2 text-sm font-normal text-slate-400">
              Coming in Module 4
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-6 text-center text-lg font-medium">
            Return Equipment
            <p className="mt-2 text-sm font-normal text-slate-400">
              Coming in Module 4
            </p>
          </div>
        </div>

        {session.role === "ADMIN" ? (
          <Link
            href="/dashboard/admin"
            className="inline-block text-sm text-emerald-400 hover:underline"
          >
            Admin area →
          </Link>
        ) : (
          <p className="text-sm text-slate-500">
            Admin tools are available to administrators only.
          </p>
        )}
      </div>
    </main>
  );
}
