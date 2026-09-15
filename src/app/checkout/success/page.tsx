import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import Link from "next/link";

export const metadata = {
  title: "Plată reușită · ShopTruck",
};

export default function PaymentSuccessPage() {
  return (
    <>
      <MainHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8 sm:p-12">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Plata a fost procesată cu succes!
          </h1>
          <p className="mb-6 text-sm text-slate-700">
            Comanda ta a fost confirmată. Vei primi un email cu detaliile comenzii.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/account"
              className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Contul meu
            </Link>
            <Link
              href="/catalog"
              className="inline-block rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
            >
              Continuă cumpărăturile
            </Link>
          </div>
        </div>
      </main>
      <MainFooter />
    </>
  );
}
