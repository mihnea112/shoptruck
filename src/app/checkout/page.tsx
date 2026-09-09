import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import CheckoutClient from "./CheckoutClient";

export const metadata = {
  title: "Finalizare comandă · ShopTruck",
};

export default function CheckoutPage() {
  return (
    <>
      <MainHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 sm:mb-8">
          Finalizare comandă
        </h1>
        <CheckoutClient />
      </main>
      <MainFooter />
    </>
  );
}
