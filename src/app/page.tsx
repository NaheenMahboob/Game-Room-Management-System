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
          Module 1 sanity check — database connectivity and seed status.
        </p>

        {dbError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-red-200">
            <p className="font-medium">Database connection failed</p>
            <p className="mt-2 text-sm break-words">{dbError}</p>
            <p className="mt-3 text-sm text-red-300/80">
              Run <code className="text-red-100">npm run db:up</code>, then{" "}
              <code className="text-red-100">npm run db:migrate</code> and{" "}
              <code className="text-red-100">npm run db:seed</code>.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-100 space-y-2">
            <p className="font-medium">DB connected</p>
            <p>
              Equipment items:{" "}
              <span className="font-mono text-lg">{equipmentCount}</span>
              {equipmentCount === 46 ? " (expected 46)" : " (expected 46 — re-run seed)"}
            </p>
            <p>
              Admin user:{" "}
              <span className="font-mono">{adminEmail ?? "not found"}</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
