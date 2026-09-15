import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import Link from "next/link";

export const metadata = {
  title: "Plată eșuată · ShopTruck",
};

export default function PaymentFailedPage() {
  return (
    <>
      <MainHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 sm:p-12">
          <div className="mb-4 text-5xl">❌</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Plata nu a fost procesată
          </h1>
          <p className="mb-6 text-sm text-slate-700">
            A apărut o problemă la procesarea plății. Te rugăm să încerci din nou
            sau să ne contactezi.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/checkout"
              className="inline-block rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition"
            >
              Încearcă din nou
            </Link>
            <Link
              href="/catalog"
              className="inline-block rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
            >
              Înapoi la catalog
            </Link>
          </div>
        </div>
      </main>
      <MainFooter />
    </>
  );
}
