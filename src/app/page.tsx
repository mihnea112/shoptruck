import Link from "next/link";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

import { headers } from "next/headers";

const highlights = [
  "Identificăm piesa după seria de șasiu",
  "Stoc în România, livrare rapidă",
  "Prețuri speciale pentru flote B2B",
  "Piese testate în condiții reale de lucru",
];

type HomeProduct = {
  id: string;
  slug: string;
  name: string;
  short: string;
  price_gross: number;
  image_url: string | null;
};

function ceilToLeu(n: number) {
  return Math.ceil(n);
}

function normalizeTaxRate(rate: number) {
  return rate <= 1 ? rate : rate / 100;
}

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

type PublicProductsResponse = {
  ok: boolean;
  items?: Array<{
    id: string;
    slug: string;
    name: string;
    short?: string | null;
    price_gross?: number | string | null;
    primary_image_url?: string | null;
    image_url?: string | null;
  }>;
};

async function getBaseUrl() {
  // Next.js dynamic APIs are async in recent versions
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";

  // Prefer explicit env in prod if provided
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  if (envBase) return envBase.replace(/\/$/, "");

  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

type HomeCategory = {
  id: string;
  slug: string;
  name: string;
  product_count: number;
};

async function getCategories(): Promise<HomeCategory[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/public/categories`, {
    next: { revalidate: 300 },
    headers: { accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!data?.ok || !Array.isArray(data.items)) return [];
  // Only categories that have products
  return data.items.filter((c: any) => Number(c.product_count) > 0).slice(0, 8);
}

async function getLatestProducts(limit = 4): Promise<HomeProduct[]> {
  const base = await getBaseUrl();
  const res = await fetch(
    `${base}/api/public/products?limit=${encodeURIComponent(String(limit))}`,
    {
      // cached for 60s; change to `cache: "no-store"` if you want always-fresh
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    },
  );

  const data = (await res.json().catch(() => ({}))) as PublicProductsResponse;
  if (!res.ok || !data?.ok) return [];

  const items = Array.isArray(data.items) ? data.items : [];

  return items.slice(0, limit).map((p) => {
    const short =
      (p.short && String(p.short).trim()) ||
      "Piesă compatibilă pentru camioane. Detalii în pagina produsului.";
    const price = p.price_gross == null ? 0 : Number(p.price_gross);
    const image = (p.primary_image_url ?? p.image_url ?? null) as string | null;

    return {
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
      short,
      price_gross: Number.isFinite(price) ? price : 0,
      image_url: image,
    };
  });
}

export default async function HomePage() {
  const latestProducts = await getLatestProducts(4);
  const categories = await getCategories();

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-black via-neutral-900 to-neutral-800">
      <MainHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="border-b border-slate-900 bg-linear-to-br from-black via-neutral-900 to-neutral-800 text-white">
          <div className="flex w-full flex-col gap-12 px-4 sm:px-6 lg:px-8 py-16 lg:flex-row lg:items-center">
            <div className="flex-1 space-y-6">
              <span className="inline-flex items-center rounded-full bg-[#feab1f]/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-[#feab1f]">
                AutoTruck · Webshop nou
              </span>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Webshop de{" "}
                <span className="text-[#feab1f]">piese de camion.</span>
              </h1>
              <p className="max-w-2xl text-base text-slate-200">
                Căutare rapidă după marcă, model, an și cod OEM. Piese originale
                și aftermarket, cu suport real de la oameni care chiar lucrează
                cu camioane.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/catalog"
                  className="rounded-full bg-[#feab1f] px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-[#feab1f]/30 transition hover:bg-[#feab1f]/90"
                >
                  Vezi catalogul
                </Link>
                <Link
                  href="/truck/man"
                  className="rounded-full border border-slate-600 px-6 py-3 text-sm font-medium text-slate-100 hover:border-[#feab1f] hover:text-[#feab1f] transition"
                >
                  Caută piese după camion
                </Link>
              </div>

              <ul className="mt-4 grid max-w-xl gap-2 text-sm text-slate-200 sm:grid-cols-2">
                {highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-[#feab1f]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* demo card */}
            <div className="flex-1">
              <div className="ml-auto max-w-xl rounded-3xl border border-slate-700/60 bg-linear-to-br from-black via-neutral-900 to-neutral-800 p-6 shadow-2xl">
                <h2 className="mb-4 text-sm font-semibold text-slate-100">
                  Căutare rapidă (demo UI)
                </h2>
                <div className="space-y-4 text-sm text-slate-200">
                  <p>
                    În versiunea finală, aici clientul își alege rapid camionul
                    și codul piesei:
                  </p>
                  <div className="space-y-3 rounded-2xl bg-linear-to-br from-black via-neutral-900 to-neutral-800 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">
                          Marcă camion
                        </label>
                        <div className="rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-xs text-slate-200">
                          MAN / DAF / Volvo / Scania / Mercedes
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">
                          Model & an
                        </label>
                        <div className="rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-xs text-slate-200">
                          TGX 2018 · FH4 2016 · Actros MP4...
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">
                        Cod OEM sau descriere piesă
                      </label>
                      <div className="rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-xs text-slate-200">
                        Ex: 81.50806.6050 · „kit etrier stânga față”
                      </div>
                    </div>
                    <button className="w-full rounded-full bg-[#feab1f] px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-[#feab1f]/90 transition">
                      Caută piese compatibile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ✅ PRODUSE RECENTE DIN DB */}
        <section className="border-b border-slate-200 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  Produse recente
                </h2>
                <p className="text-sm text-slate-500">
                  Ultimele produse active adăugate în catalog.
                </p>
              </div>
              <Link
                href="/catalog"
                className="text-sm font-medium text-[#feab1f] hover:text-[#feab1f]/80"
              >
                Vezi tot catalogul →
              </Link>
            </div>

            {latestProducts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Nu există produse active în DB.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {latestProducts.map((prod) => (
                  <div
                    key={prod.slug}
                    className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm transition hover:-translate-y-1 hover:border-[#feab1f] hover:shadow-lg"
                  >
                    <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img
                        src={prod.image_url ?? "/placeholder-product.jpg"}
                        alt={prod.name}
                        className="h-80 md:h-96 w-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <h3 className="mb-2 text-sm font-semibold text-slate-900">
                      {prod.name}
                    </h3>
                    <p className="mb-4 text-xs text-slate-500">{prod.short}</p>

                    <div className="mb-4 space-y-1 text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold text-slate-900">
                          {formatRON(prod.price_gross)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Preț cu TVA
                      </span>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                      <Link
                        href={`/produs/${prod.slug}`}
                        className="w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition text-center"
                      >
                        Vezi detalii produs
                      </Link>
                      <button className="w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-[#feab1f] hover:text-[#feab1f] transition">
                        Adaugă în coș
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CATEGORII */}
        <section className="bg-slate-50">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-14">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  Categorii principale
                </h2>
                <p className="text-sm text-slate-500">
                  Structură clară, ca să ajungi rapid la ce te interesează.
                </p>
              </div>
              <Link
                href="/catalog"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Vezi toate categoriile →
              </Link>
            </div>

            {categories.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Nicio categorie disponibila momentan.
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/catalog?categoryId=${cat.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#feab1f]">
                        {cat.name}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                        {cat.product_count} piese
                      </span>
                    </div>
                    <span className="mt-4 text-sm font-medium text-[#feab1f] group-hover:text-[#feab1f]/80">
                      Vezi piese →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <MainFooter />
    </div>
  );
}
