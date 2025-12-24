"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/produse", label: "Produse" },
  { href: "/admin/comenzi", label: "Comenzi" },
  { href: "/admin/clienti", label: "Clienți" },
  { href: "/admin/blog", label: "Blog" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 border-r border-slate-200 bg-slate-50/80 px-4 py-6 text-sm md:block">
      <div className="mb-6 space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          AutoTruck
        </div>
        <div className="text-base font-semibold text-slate-900">
          Admin Panel
        </div>
        <div className="text-xs text-slate-500">
          Management produse, comenzi și conținut.
        </div>
      </div>

      <nav className="space-y-1.5">
        {adminNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span>{item.label}</span>
              {active && (
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}