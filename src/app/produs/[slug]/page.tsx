import Link from "next/link";
import { headers } from "next/headers";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import { ProductActions } from "@/components/product/ProductActions";
import { EquivalentCodesSection } from "@/components/product/EquivalentCodesSection";
import { SuggestedProductsCarousel } from "@/components/product/SuggestedProductsCarousel";

type PublicImage = {
  storage_path: string;
  url: string | null;
  is_primary: boolean;
  sort_order: number | null;
};

type DbCode = {
  code_raw: string;
  code_norm: string;
  is_primary: boolean;
  code_kind?: string;
  note?: string;
};

type DbProduct = {
  id: string;
  slug: string;
  name: string;
  sku: string;

  // Optional (depending on your API)
  short: string | null;
  description: string | null;

  brand_name: string | null;
  category_name: string | null;

  primary_code: string | null;
  equivalent_codes?: string[];
  all_codes?: DbCode[];

  price_gross: number | null;
  discount_price: number | null;
  discount_active: boolean;
  discount_percentage: number;

  primary_image_url: string | null;
  images: PublicImage[];

  in_stock: boolean | null;
  stock_available?: number | null;
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
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) return null;

  const item = data.item;
  if (!item) return null;
  // Attach warehouses and related products to the product object for use in the page
  (item as any)._warehouses = data.warehouses ?? [];
  (item as any)._relatedProducts = data.relatedProducts ?? [];
  (item as any)._suggestedProducts = data.suggestedProducts ?? [];
  return item as DbProduct;
}

type WarehouseStock = {
  id: string;
  name: string;
  code: string;
  stock_available: number;
  stock_on_hand: number;
};

type RelatedProduct = {
  id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  price_gross: number;
  image_url: string | null;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  const warehouseStock: WarehouseStock[] = (product as any)?._warehouses ?? [];
  const relatedProducts: RelatedProduct[] =
    (product as any)?._relatedProducts ?? [];
  const suggestedProducts: RelatedProduct[] =
    (product as any)?._suggestedProducts ?? [];

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
          <div className="w-full px-4 py-10 lg:px-6 xl:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* LEFT: image + small info */}
              <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm aspect-[5/4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mainImage}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                {thumbs.length > 1 ? (
                  <div className="grid grid-cols-6 gap-2">
                    {thumbs.map((u) => (
                      <div
                        key={u}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white aspect-[5/4]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt="Imagine produs"
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-xs text-slate-600 md:grid-cols-2">
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
                </div>
              </div>

              {/* RIGHT: main info, price, actions */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {product.name}
                  </h1>
                  {product.sku && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 inline-block">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-700 font-semibold">
                        SKU
                      </div>
                      <div className="text-sm font-mono font-bold text-amber-900">
                        {product.sku}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price block */}
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        Preț
                      </div>
                      <div className="flex items-baseline gap-2">
                        {product.discount_active && product.discount_price ? (
                          <>
                            <span className="text-sm font-medium text-slate-500 line-through">
                              {price == null ? "—" : formatRON(price)}
                            </span>
                            <span className="text-2xl font-semibold text-green-600">
                              {formatRON(product.discount_price)}
                            </span>
                            <span className="text-sm font-bold text-white bg-red-600 px-2 py-1 rounded-lg">
                              -{product.discount_percentage}%
                            </span>
                          </>
                        ) : (
                          <span className="text-2xl font-semibold text-slate-900">
                            {price == null ? "—" : formatRON(price)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Preț final cu TVA
                        {product.discount_active &&
                          product.discount_price &&
                          price && (
                            <div className="text-green-600 font-medium mt-1">
                              💚 Economisesti{" "}
                              {formatRON(price - product.discount_price)}
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="text-xs text-right">
                      {(() => {
                        const qty =
                          product.stock_available ?? (inStock ? 99 : 0);
                        if (qty <= 0)
                          return (
                            <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600">
                              Stoc epuizat
                            </span>
                          );
                        if (qty <= 5)
                          return (
                            <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                              {qty} bucati disponibile
                            </span>
                          );
                        if (qty < 10)
                          return (
                            <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-600">
                              Stoc limitat
                            </span>
                          );
                        return (
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            Stoc suficient
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3">
                    <ProductActions
                      productId={product.id}
                      productName={product.name}
                      productSlug={product.slug}
                      inStock={inStock}
                    />
                  </div>
                </div>

                {/* Warehouse stock */}
                {warehouseStock.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Disponibilitate depozite
                    </div>
                    <div className="space-y-2">
                      {warehouseStock.map((wh) => {
                        const qty = Number(wh.stock_available);
                        return (
                          <div
                            key={wh.id}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="rounded-md bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                {wh.code}
                              </span>
                              {wh.name}
                            </div>
                            <div>
                              {qty <= 0 ? (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-500">
                                  Indisponibil
                                </span>
                              ) : qty <= 5 ? (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  {qty} buc
                                </span>
                              ) : qty < 10 ? (
                                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                                  Stoc limitat
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  Stoc suficient
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Livrare */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Livrare & suport
                  </div>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Livrare rapida in 24-48h pentru produsele aflate in stoc.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Suport telefonic pentru identificarea piesei corecte.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Retur acceptat pentru piese nemontate, in ambalaj
                      original.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Description / details */}
            <div className="mt-10 space-y-8">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Descriere detaliată
                </h2>
                <div className="prose prose-sm max-w-none rounded-2xl border border-slate-200 bg-white px-6 py-5">
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            {/* Full-Width Equivalent Codes Section */}
            <EquivalentCodesSection codes={product.equivalent_codes || []} />

            {/* You Might Also Like Section (Suggested Products Carousel) */}
            {suggestedProducts.length > 0 && (
              <SuggestedProductsCarousel products={suggestedProducts} />
            )}
          </div>
        </section>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="border-t border-slate-200 bg-white">
            <div className="w-full px-6 py-10 lg:px-10 xl:px-16">
              <h2 className="mb-8 text-2xl font-semibold text-slate-900">
                Produse cu coduri echivalente
              </h2>
              <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {relatedProducts.map((relProd) => (
                  <Link
                    key={relProd.id}
                    href={`/produs/${relProd.slug}`}
                    className="group rounded-xl border border-slate-200 overflow-hidden bg-white hover:shadow-lg transition"
                  >
                    <div className="aspect-[5/4] bg-slate-100 overflow-hidden">
                      {relProd.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={relProd.image_url}
                          alt={relProd.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          Fără imagine
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="mb-2 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-700">
                        {relProd.name}
                      </h3>
                      {relProd.brand_name && (
                        <p className="text-xs text-slate-500 mb-2">
                          {relProd.brand_name}
                        </p>
                      )}
                      <div className="text-sm font-semibold text-slate-900">
                        {formatRON(relProd.price_gross)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <MainFooter />
    </div>
  );
}
