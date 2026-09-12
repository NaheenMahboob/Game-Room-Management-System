"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard/admin", label: "Overview" },
  { href: "/dashboard/admin/analytics", label: "Analytics" },
  { href: "/dashboard/admin/inventory", label: "Inventory" },
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/shifts", label: "Shifts" },
  { href: "/dashboard/admin/content", label: "Content" },
  { href: "/dashboard/admin/waivers", label: "Waivers" },
  { href: "/dashboard/admin/settings", label: "Settings" },
  { href: "/dashboard/admin/audit", label: "Audit" },
];
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active =
          link.href === "/dashboard/admin"
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold ${
              active
                ? "bg-amber-500 text-slate-950"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
