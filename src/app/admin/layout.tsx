import { AdminSidebar } from "@/components/admin/AdminSidebar";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 text-sm">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Admin · ShopTruck.ro
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              Dashboard operațional
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition"
            >
              Vezi site public
            </Link>
            <button className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}