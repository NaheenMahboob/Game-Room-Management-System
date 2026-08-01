import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { ToastProvider } from "@/components/ui/Toast";
import { getSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {session &&
        (session.role === "VOLUNTEER" || session.role === "ADMIN") ? (
          <DashboardNav email={session.email} role={session.role} />
        ) : null}
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </div>
    </ToastProvider>
  );
}
