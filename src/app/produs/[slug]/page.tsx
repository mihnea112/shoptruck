import Link from "next/link";
import { headers } from "next/headers";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

type PublicImage = {
  storage_path: string;
  url: string | null;
  is_primary: boolean;
  sort_order: number | null;
};

type DbProduct = {
  id: string;
  slug: string;
  name: string;

  // Optional (depending on your API)
  short: string | null;
  description: string | null;

  brand_name: string | null;
  category_name: string | null;

  primary_code: string | null;

  price_gross: number | null;

  primary_image_url: string | null;
  images: PublicImage[];

  in_stock: boolean | null;
};

type ApiOne<T> = { ok: true; item: T } | { ok: false; error: string };

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

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

async function getProductBySlug(slug: string): Promise<DbProduct | null> {
  const base = await getBaseUrl();

  const res = await fetch(
    `${base}/api/public/products/${encodeURIComponent(slug)}`,
    {
      // product page can be cached a bit; change to no-store if you want
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
    }
  );

  const data = (await res.json().catch(() => ({}))) as ApiOne<DbProduct>;
  if (!res.ok || !("ok" in data) || !data.ok) return null;

  return data.item ?? null;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <MainHeader />

        <main className="flex-1">
          <section className="border-b border-slate-200 bg-white/80">
            <div className="w-full px-6 py-4 text-sm text-slate-500 lg:px-10 xl:px-16">
              <nav className="flex flex-wrap items-center gap-1 text-xs">
                <Link href="/" className="hover:text-slate-800">
                  Acasă
                </Link>
                <span>/</span>
                <span className="text-slate-700">Produs inexistent</span>
              </nav>
            </div>
          </section>

          <section className="bg-white">
            <div className="w-full px-6 py-10 lg:px-10 xl:px-16">
              <h1 className="mb-2 text-xl font-semibold text-slate-900">
                Nu există produs cu acest slug.
              </h1>
              <p className="text-sm text-slate-600">
                Slug:{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  {slug}
                </code>
              </p>
              <p className="mt-4 text-sm text-slate-500">
                Verifică dacă produsul există în DB și dacă este activ.
              </p>
            </div>
          </section>
        </main>

        <MainFooter />
      </div>
    );
  }

  const brand = product.brand_name || "—";
  const category = product.category_name || "—";
  const short =
    (product.short && product.short.trim()) ||
    "Piesă compatibilă pentru camioane. Detalii în pagina produsului.";
  const description =
    (product.description && product.description.trim()) ||
    "Descrierea detaliată nu este încă setată pentru acest produs.";
  const price =
    product.price_gross != null && Number.isFinite(Number(product.price_gross))
      ? Number(product.price_gross)
      : null;

  const inStock = product.in_stock ?? true;

  const images = Array.isArray(product.images) ? product.images : [];
  const mainImage =
    product.primary_image_url ||
    images.find((x) => x.is_primary)?.url ||
    images[0]?.url ||
    "/placeholder-product.jpg";

  // build thumbnails (dedupe by url)
  const thumbs = images
    .map((x) => x.url)
    .filter((u): u is string => !!u)
    .filter((u, idx, arr) => arr.indexOf(u) === idx)
    .slice(0, 6);

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
              <Link href="/catalog" className="hover:text-slate-800">
                Catalog
              </Link>
              <span>/</span>
              <span className="text-slate-700">{product.name}</span>
            </nav>
          </div>
        </section>

        {/* PRODUCT SECTION */}
        <section className="border-b border-slate-200 bg-white">
          <div className="w-full px-6 py-10 lg:px-10 xl:px-16">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* LEFT: image + small info */}
              <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mainImage}
                    alt={product.name}
                    className="h-[420px] w-full object-cover md:h-[520px]"
                    loading="lazy"
                  />
                </div>

                {thumbs.length > 1 ? (
                  <div className="grid grid-cols-6 gap-2">
                    {thumbs.map((u) => (
                      <div
                        key={u}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt="Imagine produs"
                          className="h-16 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-xs text-slate-600 md:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Brand
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {brand}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Categorie
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {category}
                    </div>
                  </div>

                  {product.primary_code ? (
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Cod OEM (referință)
                      </div>
                      <div className="text-[11px] font-mono text-slate-800">
                        {product.primary_code}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Cod OEM (referință)
                      </div>
                      <div className="text-[11px] text-slate-500">—</div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: main info, price, actions */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {product.name}
                  </h1>
                  <p className="text-sm text-slate-600 max-w-xl">{short}</p>
                </div>

                {/* Price block */}
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        Preț
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-slate-900">
                          {price == null ? "—" : formatRON(price)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Preț final cu TVA · Factură fiscală inclusă
                      </div>
                    </div>
                    <div className="text-xs text-right">
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                          inStock
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {inStock ? "În stoc" : "Stoc epuizat"}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      className="flex-1 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={!inStock}
                    >
                      Adaugă în coș
                    </button>
                    <button className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-[#feab1f] hover:text-[#feab1f] transition">
                      Comandă pe WhatsApp
                    </button>
                  </div>
                </div>

                {/* Compatibility + shipping info (still demo / placeholder) */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Compatibilitate camion
                    </div>
                    <p className="text-xs text-slate-500">
                      Compatibilitatea detaliată va fi afișată aici după ce legi
                      tabela de compatibilitate (ex: product_truck_compatibility).
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Livrare & suport
                    </div>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Livrare rapidă în 24–48h pentru produsele aflate în stoc.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Suport telefonic pentru identificarea piesei corecte.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Retur acceptat pentru piese nemontate, în ambalaj original.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Description / details */}
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-slate-900">
                  Descriere detaliată
                </h2>
                <p className="text-sm leading-relaxed text-slate-700">
                  {description}
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <h3 className="text-sm font-semibold text-slate-900">
                  Recomandări de montaj
                </h3>
                <ul className="space-y-1 text-xs">
                  <li>
                    • Se recomandă montajul într-un service autorizat și folosirea
                    de scule adecvate.
                  </li>
                  <li>
                    • Verifică întotdeauna compatibilitatea pe seria de șasiu
                    înainte de montaj.
                  </li>
                  <li>
                    • Pentru rezultate optime, se recomandă înlocuirea în set.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MainFooter />
    </div>
  );
}