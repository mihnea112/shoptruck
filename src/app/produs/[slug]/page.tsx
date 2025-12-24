import Link from "next/link";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

type Product = {
  slug: string;
  name: string;
  brand: string;
  tag?: string;
  category: string;
  short: string;
  description: string;
  oldPrice?: string;
  newPrice: string;
  discount?: string;
  oemCode?: string;
  inStock: boolean;
  truckModels: string[];
};

const demoProducts: Record<string, Product> = {
  "kit-ambreiaj-sachs-volvo-fh": {
    slug: "kit-ambreiaj-sachs-volvo-fh",
    name: "Kit ambreiaj Sachs · Volvo FH",
    brand: "Sachs",
    tag: "Lichidare stoc",
    category: "Ambreiaj & transmisie",
    short:
      "Kit complet ambreiaj Sachs pentru camioane Volvo FH, testat în flotă.",
    description:
      "Kit complet ambreiaj Sachs pentru camioane Volvo FH, recomandat pentru exploatare intensivă. Asigură o cuplare lină, durabilitate ridicată și protecție pentru transmisie în regim de sarcină mare. Ideal pentru flote care rulează preponderent în internațional și doresc să reducă timpii de imobilizare în service.",
    oldPrice: "3.200 RON",
    newPrice: "2.590 RON",
    discount: "-19%",
    oemCode: "Volvo OEM 85012345 (exemplu)",
    inStock: true,
    truckModels: ["Volvo FH4 2013–2018", "Volvo FH 2019+ (unele variante)"],
  },
  "far-xenon-mercedes-actros": {
    slug: "far-xenon-mercedes-actros",
    name: "Far Xenon stânga · Mercedes Actros MP4",
    brand: "Aftermarket premium",
    tag: "Promoție limitată",
    category: "Electric & iluminare",
    short:
      "Far Xenon stânga pentru Mercedes Actros MP4, vizibilitate superioară pe timp de noapte.",
    description:
      "Far Xenon stânga pentru Mercedes Actros MP4, cu fascicul de lumină optimizat pentru utilizarea pe autostradă și drumuri naționale. Carcasă rezistentă la vibrații și condiții meteo dificile, compatibil cu prinderea originală. Oferă vizibilitate superioară și reduce oboseala șoferului în cursele de noapte.",
    oldPrice: "1.450 RON",
    newPrice: "1.190 RON",
    discount: "-18%",
    oemCode: "Mercedes OEM A9608202361 (exemplu)",
    inStock: true,
    truckModels: ["Mercedes Actros MP4 2011–2019"],
  },
  "disc-frana-breckner-volvo": {
    slug: "disc-frana-breckner-volvo",
    name: "Disc frână ventilat Breckner · Volvo/Renault",
    brand: "Breckner",
    tag: "Preț special",
    category: "Frâne & etriere",
    short:
      "Disc frână ventilat Breckner pentru gamele Volvo/Renault, pentru frânare constantă și sigură.",
    description:
      "Disc de frână ventilat Breckner, proiectat pentru camioane Volvo și Renault. Asigură disiparea eficientă a căldurii și frânare constantă chiar și în condiții de încărcare maximă sau coborâri lungi. Recomandat a fi montat împreună cu plăcuțe de frână compatibile de calitate, pentru performanță optimă.",
    oldPrice: "780 RON",
    newPrice: "629 RON",
    discount: "-19%",
    oemCode: "Volvo OEM 20485792 / Renault Trucks 7420485792 (exemplu)",
    inStock: true,
    truckModels: ["Volvo FH / FM", "Renault Premium / Magnum (anumite axe)"],
  },
  "amortizor-spate-breckner-man": {
    slug: "amortizor-spate-breckner-man",
    name: "Amortizor spate Breckner · MAN",
    brand: "Breckner",
    tag: "Lichidare stoc",
    category: "Suspensie & amortizoare",
    short:
      "Amortizor spate Breckner pentru camioane MAN, pentru stabilitate și confort la sarcina maximă.",
    description:
      "Amortizor spate Breckner pentru camioane MAN, potrivit pentru exploatare mixtă (național / internațional). Reduce balansul și vibrațiile cabinei, îmbunătățind confortul șoferului și stabilitatea ansamblului în curbe sau la frânări puternice. Recomandat pentru înlocuirea în perechi.",
    oldPrice: "650 RON",
    newPrice: "529 RON",
    discount: "-19%",
    oemCode: "MAN OEM 81417226089 (exemplu)",
    inStock: true,
    truckModels: ["MAN TGX / TGS (anumite axe spate)"],
  },
};

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  console.log("SLUG PAGE:", slug);

  const product = demoProducts[slug];

  if (!product) {
    console.log("PRODUS INEXISTENT PENTRU SLUG:", slug);

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
                Verifică dacă slug-ul din URL este identic cu cheia definită în
                `demoProducts` sau cu cea stocată în baza de date.
              </p>
            </div>
          </section>
        </main>

        <MainFooter />
      </div>
    );
  }

  const hasPromo = !!product.oldPrice && !!product.discount;

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
              <Link href="/promotii" className="hover:text-slate-800">
                Promoții
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
                <div className="aspect-4/3 w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
                  {/* Placeholder imagine produs – în realitate vei folosi next/image */}
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Imagine produs (placeholder UI)
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-xs text-slate-600 md:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Brand
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {product.brand}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Categorie
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {product.category}
                    </div>
                  </div>
                  {product.oemCode && (
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Cod OEM (referință)
                      </div>
                      <div className="text-[11px] font-mono text-slate-800">
                        {product.oemCode}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: main info, price, actions */}
              <div className="space-y-6">
                {product.tag && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#feab1f]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#feab1f]">
                    <span>{product.tag}</span>
                    {product.discount && (
                      <span className="rounded-full bg-[#feab1f] px-2 py-0.5 text-[10px] text-slate-950">
                        {product.discount}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {product.name}
                  </h1>
                  <p className="text-sm text-slate-600 max-w-xl">{product.short}</p>
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
                          {product.newPrice}
                        </span>
                        {hasPromo && (
                          <span className="text-sm text-slate-400 line-through">
                            {product.oldPrice}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Preț final cu TVA · Factură fiscală inclusă
                      </div>
                    </div>
                    <div className="text-xs text-right">
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                          product.inStock
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {product.inStock ? "În stoc" : "Stoc epuizat"}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      className="flex-1 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={!product.inStock}
                    >
                      Adaugă în coș
                    </button>
                    <button className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-[#feab1f] hover:text-[#feab1f] transition">
                      Comandă pe WhatsApp
                    </button>
                  </div>
                </div>

                {/* Compatibility + shipping info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Compatibilitate camion
                    </div>
                    {product.truckModels.length ? (
                      <ul className="space-y-1 text-sm">
                        {product.truckModels.map((m) => (
                          <li key={m} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            {m}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Compatibilitatea detaliată va fi afișată aici. În
                        producție vei lega acest bloc la tabela
                        product_truck_compatibility.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Livrare & suport
                    </div>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Livrare rapidă în 24–48h pentru produsele aflate în
                        stoc.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Suport telefonic pentru identificarea piesei corecte.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Retur acceptat pentru piese nemontate, în ambalaj
                        original.
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
                  {product.description}
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
                    • Pentru rezultate optime, se recomandă înlocuirea în set
                    (acolo unde este cazul – ex: amortizoare pe axă).
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
