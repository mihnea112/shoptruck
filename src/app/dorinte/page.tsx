import Link from "next/link";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import WishlistClient from "./WishlistClient";

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";

  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  if (envBase) return envBase.replace(/\/$/, "");

  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

export default async function WishlistPage() {
  // Check if user is authenticated
  const user = await getSessionUser();
  if (!user || user.kind !== "customer") {
    redirect(`/login?next=/dorinte`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <MainHeader />

      <main className="flex-1">
        {/* BREADCRUMBS */}
        <section className="border-b border-slate-200 bg-white/80">
          <div className="w-full px-6 py-4 text-sm text-slate-500 lg:px-10 xl:px-16">
            <nav className="flex flex-wrap items-center gap-1 text-xs">
              <Link href="/" className="hover:text-slate-800">
                Acasă
              </Link>
              <span>/</span>
              <span className="text-slate-700">Dorințele mele</span>
            </nav>
          </div>
        </section>

        {/* CONTENT */}
        <section className="border-b border-slate-200 bg-white">
          <div className="w-full px-6 py-10 lg:px-10 xl:px-16">
            <div className="max-w-4xl">
              <h1 className="mb-2 text-2xl font-semibold text-slate-900">
                Dorințele mele
              </h1>
              <p className="mb-6 text-sm text-slate-600">
                Produsele pe care le-ai salvat pentru mai târziu
              </p>

              {/* Wishlist Client Component */}
              <WishlistClient />
            </div>
          </div>
        </section>
      </main>

      <MainFooter />
    </div>
  );
}
