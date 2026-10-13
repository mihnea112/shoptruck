import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import Link from "next/link";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

export const metadata = {
  title: "Plată reușită · ShopTruck",
};

type OrderStatus = {
  paid: boolean;
  invoiceSeries: string | null;
  invoiceNumber: number | null;
  anafStatus: string | null;
};

async function loadOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const orders = (await sql`
    SELECT o.id, o.payment_status
    FROM "order" o
    JOIN account a ON a.id = o.account_id
    WHERE o.id = ${orderId}::uuid AND a.user_id = ${user.userId}::uuid
    LIMIT 1
  `) as any[];
  if (!orders.length) return null;

  const invoices = (await sql`
    SELECT series, number, anaf_status
    FROM invoice
    WHERE order_id = ${orderId}::uuid AND invoice_type = 'definitiva'
    LIMIT 1
  `) as any[];
  const inv = invoices[0] || null;

  return {
    paid: orders[0].payment_status === "paid",
    invoiceSeries: inv?.series ?? null,
    invoiceNumber: inv?.number ?? null,
    anafStatus: inv?.anaf_status ?? null,
  };
}

function statusMessage(status: OrderStatus | null): string {
  if (!status) {
    return "Comanda ta a fost confirmată. Vei primi un email cu detaliile comenzii.";
  }
  if (!status.paid) {
    return "Confirmăm plata comenzii. Vei primi un email de îndată ce este procesată.";
  }
  if (!status.invoiceSeries) {
    return "Comanda ta a fost confirmată. Factura se emite și se transmite automat către ANAF (e-Factura).";
  }
  if (status.anafStatus === "ok") {
    return `Comanda ta a fost confirmată. Factura ${status.invoiceSeries}/${status.invoiceNumber} a fost emisă și confirmată de ANAF.`;
  }
  if (status.anafStatus === "trimisa") {
    return `Comanda ta a fost confirmată. Factura ${status.invoiceSeries}/${status.invoiceNumber} a fost transmisă la ANAF și așteaptă confirmarea.`;
  }
  if (status.anafStatus === "nok" || status.anafStatus === "eroare") {
    return `Comanda ta a fost confirmată. Factura ${status.invoiceSeries}/${status.invoiceNumber} a fost emisă — echipa noastră finalizează transmiterea ei către ANAF.`;
  }
  return "Comanda ta a fost confirmată. Vei primi un email cu detaliile comenzii.";
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const orderIdRaw = Array.isArray(sp?.order_id) ? sp.order_id[0] : sp?.order_id;
  const orderId = typeof orderIdRaw === "string" && /^[0-9a-f-]{36}$/i.test(orderIdRaw) ? orderIdRaw : null;

  const status = orderId ? await loadOrderStatus(orderId) : null;
  const message = statusMessage(status);

  return (
    <>
      <MainHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8 sm:p-12">
          <div className="mb-4 text-5xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Plata a fost procesată cu succes!
          </h1>
          <p className="mb-6 text-sm text-slate-700">{message}</p>
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
