import Link from "next/link";
import { getSessionUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/account`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <MainHeader />

      <main className="flex-1 w-full">
        {/* BREADCRUMBS */}
        <section className="border-b border-slate-200 bg-white/80 w-full">
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-16 py-3 sm:py-4 text-xs sm:text-sm text-slate-500">
            <nav className="flex flex-wrap items-center gap-1">
              <Link href="/" className="hover:text-slate-800 transition">
                Acasă
              </Link>
              <span>/</span>
              <span className="text-slate-700">Contul meu</span>
            </nav>
          </div>
        </section>

        {/* CONTENT */}
        <section className="border-b border-slate-200 bg-white w-full">
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-16 py-6 sm:py-8 md:py-10">
            <div className="w-full">
              <h1 className="mb-2 text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900">
                Contul meu
              </h1>
              <p className="mb-6 text-xs sm:text-sm text-slate-600">
                Gestionează informațiile tale personale și comenzile
              </p>

              {/* Account Client Component */}
              <AccountClient />
            </div>
          </div>
        </section>
      </main>

      <MainFooter />
    </div>
  );
}