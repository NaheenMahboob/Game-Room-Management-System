import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  let equipmentCount = 0;
  let adminEmail: string | null = null;
  let dbError: string | null = null;

  try {
    equipmentCount = await prisma.equipment.count();
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { email: true },
    });
    adminEmail = admin?.email ?? null;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Unknown database error";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Game Room Management System
        </h1>
        <p className="text-slate-400">
          Module 3 — core business APIs for attendance, loans, and members.
        </p>

        {dbError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-red-200">
            <p className="font-medium">Database connection failed</p>
            <p className="mt-2 text-sm break-words">{dbError}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-100 space-y-2">
            <p className="font-medium">DB connected</p>
            <p>
              Equipment items:{" "}
              <span className="font-mono text-lg">{equipmentCount}</span>
            </p>
            <p>
              Admin user:{" "}
              <span className="font-mono">{adminEmail ?? "not found"}</span>
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/portal/login"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Member portal login
          </Link>
          <Link
            href="/dashboard/login"
            className="rounded-lg border border-slate-600 px-4 py-2.5 text-center text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Volunteer / Admin login
          </Link>
        </div>
      </div>
    </main>
  );
}
