import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ToastProvider } from "@/components/ui/Toast";

const NAV = [
  { href: "/portal", label: "Profile" },
  { href: "/portal/history", label: "History" },
  { href: "/portal/announcements", label: "Announcements" },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Show portal chrome for anyone with a linked member profile (incl. staff).
  const showNav = Boolean(session?.memberId);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {showNav ? (
          <header className="border-b border-slate-800 bg-slate-950/95">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">Member portal</p>
                <p className="text-xs text-slate-400">{session?.email}</p>
              </div>
              <nav className="flex flex-wrap gap-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="min-h-11 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold hover:bg-slate-700"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/public"
                  className="min-h-11 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-teal-200"
                >
                  Status board
                </Link>
                <LogoutButton />
              </nav>
            </div>
          </header>
        ) : null}
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </div>
    </ToastProvider>
  );
}
