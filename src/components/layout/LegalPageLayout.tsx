import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";
import Link from "next/link";

const legalLinks = [
  { href: "/terms", label: "Termeni și condiții" },
  { href: "/privacy", label: "Confidențialitate" },
  { href: "/gdpr", label: "GDPR" },
  { href: "/cookies", label: "Cookie-uri" },
  { href: "/returns", label: "Politica de retur" },
  { href: "/anpc", label: "ANPC" },
];

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <MainHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
          {title}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <nav className="lg:col-span-1 order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sticky top-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Informații legale
              </h3>
              <ul className="space-y-2">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-700 hover:text-amber-600 transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Content */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 prose prose-slate prose-sm max-w-none
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-4
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-6 [&_h3]:mb-3
              [&_p]:text-slate-700 [&_p]:leading-relaxed [&_p]:mb-4
              [&_ul]:text-slate-700 [&_li]:text-slate-700
              [&_a]:text-amber-600 [&_a]:no-underline hover:[&_a]:text-amber-500
              [&_strong]:text-slate-900
              [&_table]:w-full [&_th]:text-left [&_th]:p-2 [&_th]:bg-slate-50 [&_th]:text-slate-900 [&_th]:text-xs [&_th]:font-semibold
              [&_td]:p-2 [&_td]:text-xs [&_td]:border-t [&_td]:border-slate-100
            ">
              {children}
            </div>
          </div>
        </div>
      </main>
      <MainFooter />
    </>
  );
}
