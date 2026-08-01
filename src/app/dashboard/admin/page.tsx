import Link from "next/link";

const CARDS = [
  {
    href: "/dashboard/admin/analytics",
    title: "Analytics",
    desc: "Visits, popular equipment, community hours, CSV export",
  },
  {
    href: "/dashboard/admin/inventory",
    title: "Inventory",
    desc: "Add, edit, deactivate equipment items",
  },
  {
    href: "/dashboard/admin/users",
    title: "Users & roles",
    desc: "Create volunteers/admins, reset passwords",
  },
  {
    href: "/dashboard/admin/shifts",
    title: "Shift schedule",
    desc: "Assign recurring volunteer shifts",
  },
  {
    href: "/dashboard/admin/content",
    title: "Announcements & events",
    desc: "Public and member-facing content",
  },
  {
    href: "/dashboard/admin/settings",
    title: "Settings",
    desc: "Hours, session limits, rules, guest limit",
  },
  {
    href: "/dashboard/admin/audit",
    title: "Audit log",
    desc: "Immutable action history",
  },
];

export default function AdminHomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 hover:border-amber-500/40"
        >
          <h2 className="text-lg font-semibold">{card.title}</h2>
          <p className="mt-2 text-sm text-slate-400">{card.desc}</p>
        </Link>
      ))}
    </div>
  );
}
