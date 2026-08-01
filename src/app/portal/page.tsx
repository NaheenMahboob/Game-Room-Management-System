import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function PortalHomePage() {
  const session = await getSession();
  if (!session || session.role !== "MEMBER") {
    redirect("/portal/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Member portal</h1>
            <p className="mt-2 text-slate-400">
              Signed in as{" "}
              <span className="font-mono text-emerald-300">{session.email}</span>
            </p>
          </div>
          <LogoutButton />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
          Profile, attendance history, and QR card will land here in Module 5.
          Member ID:{" "}
          <span className="font-mono text-slate-100">
            {session.memberId ?? "n/a"}
          </span>
        </div>
      </div>
    </main>
  );
}
