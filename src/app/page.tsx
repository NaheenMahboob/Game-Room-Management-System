import { prisma } from "@/lib/prisma";
import { HomeLinks } from "@/components/home/HomeLinks";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
      <HomeLinks
        equipmentCount={equipmentCount}
        adminEmail={adminEmail}
        dbError={dbError}
      />
    </main>
  );
}
