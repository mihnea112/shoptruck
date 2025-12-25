// src/app/admin/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getSessionUser, hasAnyRole } from "@/lib/auth/server";

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      {hint ? <div className="mt-2 text-sm text-slate-600">{hint}</div> : null}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function QuickAction({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
    >
      <div className="text-sm font-semibold text-slate-900 group-hover:underline">
        {title}
      </div>
      <div className="mt-2 text-sm text-slate-600">{desc}</div>
    </Link>
  );
}

export default async function AdminHomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.kind !== "staff") redirect("/");

  const ok = hasAnyRole(user, ["ADMIN", "SALES_REP"]);
  if (!ok) redirect("/");

  const isAdmin = user.roles.includes("ADMIN");
  const isSales = user.roles.includes("SALES_REP");

  const roleLabel = isAdmin ? "Administrator" : isSales ? "Agent vânzări" : "Personal";

  // --- Stats (safe: based on tables you already use: product/category/brand/tax_rate) ---
  const [
    productTotalRow,
    productActiveRow,
    categoryTotalRow,
    brandTotalRow,
    taxRateTotalRow,
    latestProductsRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM product`,
    sql`SELECT COUNT(*)::int AS n FROM product WHERE is_active = true`,
    sql`SELECT COUNT(*)::int AS n FROM category`,
    sql`SELECT COUNT(*)::int AS n FROM brand`,
    sql`SELECT COUNT(*)::int AS n FROM tax_rate`,
    sql`
      SELECT id, name, sku, slug, price_gross, is_active, created_at
      FROM product
      ORDER BY created_at DESC
      LIMIT 8
    `,
  ]);

  const productTotal = (productTotalRow as any[])?.[0]?.n ?? 0;
  const productActive = (productActiveRow as any[])?.[0]?.n ?? 0;
  const categoryTotal = (categoryTotalRow as any[])?.[0]?.n ?? 0;
  const brandTotal = (brandTotalRow as any[])?.[0]?.n ?? 0;
  const taxRateTotal = (taxRateTotalRow as any[])?.[0]?.n ?? 0;

  const latest = (latestProductsRows as any[]) as {
    id: string;
    name: string;
    sku: string;
    slug: string;
    price_gross: number;
    is_active: boolean;
    created_at: string;
  }[];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Panou principal
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Sumar rapid pentru catalog și administrare.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#feab1f]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#b57712]">
              {roleLabel}
            </span>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 sm:inline-flex">
              {user.email}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Produse (total)"
          value={productTotal}
          hint="Toate produsele din catalog"
          href="/admin/produse"
        />
        <StatCard
          label="Produse active"
          value={productActive}
          hint="Vizibile în magazin"
          href="/admin/produse"
        />
        <StatCard
          label="Categorii"
          value={categoryTotal}
          hint="Ierarhie catalog"
          href="/admin/categorii"
        />
        <StatCard
          label="Branduri"
          value={brandTotal}
          hint="Producători/Brand"
          href="/admin/categorii"
        />
        <StatCard
          label="TVA"
          value={taxRateTotal}
          hint="Rate TVA definite"
          href="/admin/produse"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Acțiuni rapide</div>
              <div className="mt-1 text-sm text-slate-600">
                Cele mai folosite operațiuni din admin.
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <QuickAction
              href="/admin/produse"
              title="Administrare produse"
              desc="Creează, editează, setează TVA, preț, categorii, activ/inactiv."
            />
            <QuickAction
              href="/admin/categorii"
              title="Categorii & Branduri"
              desc="Organizează catalogul și structurează ierarhia."
            />
            <QuickAction
              href="/admin/orders"
              title="Comenzi"
              desc="Vizualizare și procesare comenzi (pas următor)."
            />
            {isAdmin ? (
              <QuickAction
                href="/admin/agenti"
                title="Agenți vânzări"
                desc="Creează și gestionează conturi de tip SALES_REP."
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-900">Agenți vânzări</div>
                <div className="mt-2 text-sm text-slate-600">
                  Doar administratorii pot crea/șterge utilizatori.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Latest products */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Produse recente</div>
              <div className="mt-1 text-sm text-slate-600">Ultimele adăugate</div>
            </div>
            <Link
              href="/admin/produse"
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Vezi toate
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {latest.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Nu există produse încă.
              </div>
            ) : (
              latest.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {p.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{p.sku}</span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate">{p.slug}</span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {Number(p.price_gross || 0).toFixed(2)} lei
                    </span>
                    <span
                      className={
                        "rounded-full px-2 py-1 text-[11px] font-semibold " +
                        (p.is_active
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200")
                      }
                    >
                      {p.is_active ? "Activ" : "Inactiv"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}