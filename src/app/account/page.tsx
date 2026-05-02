import Link from "next/link";
import { getSessionUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user || user.kind !== "customer") {
    redirect(`/login?next=/account`);
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
              <span className="text-slate-700">Contul meu</span>
            </nav>
          </div>
        </section>

        {/* CONTENT */}
        <section className="border-b border-slate-200 bg-white">
          <div className="w-full px-6 py-10 lg:px-10 xl:px-16">
            <div className="max-w-4xl">
              <h1 className="mb-2 text-2xl font-semibold text-slate-900">
                Contul meu
              </h1>
              <p className="mb-6 text-sm text-slate-600">
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