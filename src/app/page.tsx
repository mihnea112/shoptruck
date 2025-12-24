import Link from "next/link";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

const featuredCategories = [
  {
    slug: "frane",
    name: "Frâne & etriere",
    description: "Kituri etrier, discuri, plăcuțe, senzori ABS.",
  },
  {
    slug: "ambreiaj",
    name: "Ambreiaj & transmisie",
    description: "Kituri ambreiaj, volantă, rulmenți de presiune.",
  },
  {
    slug: "suspensie",
    name: "Suspensie & amortizoare",
    description: "Amortizoare, perne de aer, bare stabilizatoare.",
  },
  {
    slug: "electric",
    name: "Electric & iluminare",
    description: "Faruri, stopuri, senzori, Xenon & LED.",
  },
];

const highlights = [
  "Identificăm piesa după seria de șasiu",
  "Stoc în România, livrare rapidă",
  "Prețuri speciale pentru flote B2B",
  "Piese testate în condiții reale de lucru",
];

// DEMO – aici ulterior vei trage promoțiile reale din DB
const promoProducts = [
  {
    slug: "kit-ambreiaj-sachs-volvo-fh",
    name: "Kit ambreiaj Sachs · Volvo FH",
    tag: "Lichidare stoc",
    oldPrice: "3.200 RON",
    newPrice: "2.590 RON",
    discount: "-19%",
    short: "Kit complet ambreiaj Sachs pentru Volvo FH, testat în flotă.",
  },
  {
    slug: "far-xenon-mercedes-actros",
    name: "Far Xenon stânga · Mercedes Actros",
    tag: "Promoție limitată",
    oldPrice: "1.450 RON",
    newPrice: "1.190 RON",
    discount: "-18%",
    short: "Far Xenon pentru Actros MP4, vizibilitate superioară pe timp de noapte.",
  },
  {
    slug: "disc-frana-breckner-volvo",
    name: "Disc frână ventilat Breckner · Volvo",
    tag: "Preț special",
    oldPrice: "780 RON",
    newPrice: "629 RON",
    discount: "-19%",
    short: "Disc frână ventilat Breckner, compatibil game Volvo/Renault.",
  },
  {
    slug: "amortizor-spate-breckner-man",
    name: "Amortizor spate Breckner · MAN",
    tag: "Lichidare stoc",
    oldPrice: "650 RON",
    newPrice: "529 RON",
    discount: "-19%",
    short: "Amortizor spate pentru MAN, confort și stabilitate la sarcini mari.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-black via-neutral-900 to-neutral-800">
      <MainHeader />

      <main className="flex-1">
        {/* HERO full-width */}
        <section className="border-b border-slate-900 bg-linear-to-br from-black via-neutral-900 to-neutral-800 text-white">
          <div className="flex w-full flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:px-10 xl:px-16">
            {/* Text */}
            <div className="flex-1 space-y-6">
              <span className="inline-flex items-center rounded-full bg-[#feab1f]/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-[#feab1f]">
                AutoTruck · Webshop nou
              </span>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Webshop de{" "}
                <span className="text-[#feab1f]">piese de camion.</span>{" "}
        
              </h1>
              <p className="max-w-2xl text-base text-slate-200">
                Căutare rapidă după marcă, model, an și cod OEM. Promoții și
                lichidări de stoc pentru piese originale și aftermarket,
                cu suport real de la oameni care chiar lucrează cu camioane.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/promotii"
                  className="rounded-full bg-[#feab1f] px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-[#feab1f]/30 transition hover:bg-[#feab1f]/90"
                >
                  Vezi promoțiile active
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

            {/* Card demo search */}
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

        {/* 🔥 SECTIUNE PROMOȚII ACTIVE */}
        <section className="border-b border-slate-200 bg-white">
          <div className="w-full px-6 py-12 lg:px-10 xl:px-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  Promoții active
                </h2>
                <p className="text-sm text-slate-500">
                  Lichidări de stoc și prețuri speciale la piese testate în flotă.
                </p>
              </div>
              <Link
                href="/promotii"
                className="text-sm font-medium text-[#feab1f] hover:text-[#feab1f]/80"
              >
                Vezi toate promoțiile →
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {promoProducts.map((prod) => (
                <div
                  key={prod.slug}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm transition hover:-translate-y-1 hover:border-[#feab1f] hover:shadow-lg"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#feab1f]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#feab1f]">
                      {prod.tag}
                    </span>
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-[#feab1f]">
                      {prod.discount}
                    </span>
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    {prod.name}
                  </h3>
                  <p className="mb-4 text-xs text-slate-500">{prod.short}</p>

                  <div className="mb-4 space-y-1 text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-slate-900">
                        {prod.newPrice}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {prod.oldPrice}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Preț final cu TVA · Stoc limitat
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
          </div>
        </section>

        {/* CATEGORII full-width */}
        <section className="bg-slate-50">
          <div className="w-full px-6 py-14 lg:px-10 xl:px-16">
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
                href="/categorii"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Vezi toate categoriile →
              </Link>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {featuredCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/categorie/${cat.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#feab1f]">
                      {cat.name}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                      Demo
                    </span>
                  </div>
                  <p className="flex-1 text-sm text-slate-500">
                    {cat.description}
                  </p>
                  <span className="mt-4 text-sm font-medium text-[#feab1f] group-hover:text-[#feab1f]/80">
                    Vezi piese →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <MainFooter />
    </div>
  );
}