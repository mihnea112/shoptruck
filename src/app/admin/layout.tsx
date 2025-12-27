import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth/server";

function NavItem({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-transparent px-3 py-2 transition hover:border-slate-200 hover:bg-slate-50"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-[#feab1f]/15 group-hover:text-[#b57712]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {description ? (
            <div className="mt-0.5 text-xs text-slate-500">{description}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

/**
 * Collapsible group in sidebar.
 * - Default open state controlled via `defaultOpen`
 * - Uses <details>/<summary> so it works in a Server Component layout.
 */
function NavGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="list-none cursor-pointer select-none px-3 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </span>

          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </summary>

      <div className="space-y-2 px-3">
        {children}
      </div>
    </details>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.kind !== "staff") redirect("/");

  const ok = hasAnyRole(user, ["ADMIN", "SALES_REP"]);
  if (!ok) redirect("/");

  const isAdmin = user.roles.includes("ADMIN");

  const roleLabel = isAdmin
    ? "Administrator"
    : user.roles.includes("SALES_REP")
    ? "Agent vânzări"
    : "Personal";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-slate-900">
                ShopTruck
              </div>
              <div className="text-xs text-slate-500">Portal administrare</div>
            </div>
            <span className="rounded-full bg-[#feab1f]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#b57712]">
              {roleLabel}
            </span>
          </div>

          {/* ✅ Scrollable menu area */}
          <div className="flex-1 overflow-y-auto">
            <nav className="space-y-4 px-0 py-4">
              {/* GENERAL */}
              <NavGroup title="General" defaultOpen>
                <NavItem
                  href="/admin"
                  label="Panou principal"
                  description="Sumar și acțiuni rapide"
                  icon={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 12l9-9 9 9" />
                      <path d="M9 21V9h6v12" />
                    </svg>
                  }
                />

                <NavItem
                  href="/admin/orders"
                  label="Comenzi"
                  description="Vizualizare, procesare, facturare"
                  icon={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 2h12l3 7H3l3-7z" />
                      <path d="M3 9h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                      <path d="M9 13h6" />
                    </svg>
                  }
                />

                <NavItem
                  href="/admin/oferte"
                  label="Oferte"
                  description="Cotații / proforme"
                  icon={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7 3h10a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z" />
                      <path d="M8 7h8" />
                      <path d="M8 11h8" />
                      <path d="M8 15h5" />
                    </svg>
                  }
                />

                {isAdmin ? (
                  <>
                    <NavItem
                      href="/admin/facturi"
                      label="Facturi"
                      description="Vizualizare și export"
                      icon={
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-5 w-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2z" />
                          <path d="M8 8h8" />
                          <path d="M8 12h8" />
                          <path d="M8 16h6" />
                        </svg>
                      }
                    />
                    <NavItem
                      href="/admin/retururi"
                      label="Retururi"
                      description="RMA / anulări"
                      icon={
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-5 w-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 12a9 9 0 0 1 15-6" />
                          <path d="M18 6v6h-6" />
                          <path d="M21 12a9 9 0 0 1-15 6" />
                          <path d="M6 18v-6h6" />
                        </svg>
                      }
                    />
                  </>
                ) : null}
              </NavGroup>

              {/* CATALOG */}
              <NavGroup title="Catalog" defaultOpen>
                <NavItem
                  href="/admin/produse"
                  label="Produse"
                  description="Catalog, prețuri, stoc"
                  icon={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
                      <path d="M3.3 7l8.7 5 8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  }
                />

                <NavItem
                  href="/admin/categorii"
                  label="Categorii & Branduri"
                  description="Ierarhie și organizare"
                  icon={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 4h7v7H4V4z" />
                      <path d="M13 4h7v7h-7V4z" />
                      <path d="M4 13h7v7H4v-7z" />
                      <path d="M20.5 14.5l-2.6-2.6a2 2 0 0 0-1.4-.6H15a2 2 0 0 0-2 2v1.6c0 .5.2 1 .6 1.4l2.6 2.6a2 2 0 0 0 2.8 0l1.5-1.5a2 2 0 0 0 0-2.8z" />
                      <path d="M16.2 13.8h.01" />
                    </svg>
                  }
                />

                {isAdmin ? (
                  <NavItem
                    href="/admin/tva"
                    label="TVA"
                    description="Taxe / cote"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 1v22" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    }
                  />
                ) : null}
              </NavGroup>

              {/* Management */}
              {isAdmin ? (
                <NavGroup title="Management" defaultOpen={false}>
                  <NavItem
                    href="/admin/depozite"
                    label="Depozite"
                    description="Gestionare locații"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 10l9-7 9 7" />
                        <path d="M5 10v10h14V10" />
                        <path d="M9 20V14h6v6" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/stoc"
                    label="Stoc"
                    description="Disponibil / rezervat"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                        <path d="M3 8v8l9 5 9-5V8" />
                        <path d="M12 13v8" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/transferuri"
                    label="Transferuri"
                    description="Mutări între depozite"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M7 7h10" />
                        <path d="M7 7l3-3" />
                        <path d="M7 7l3 3" />
                        <path d="M17 17H7" />
                        <path d="M17 17l-3-3" />
                        <path d="M17 17l-3 3" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/miscari-stoc"
                    label="Mișcări stoc"
                    description="Audit / COGS"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 19V5" />
                        <path d="M4 19h16" />
                        <path d="M8 15l3-3 3 2 4-5" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/furnizori"
                    label="Furnizori"
                    description="Parteneri aprovizionare"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                        <path d="M9 22V12h6v10" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/aprovizionare/comenzi"
                    label="Comenzi furnizor"
                    description="PO / aprovizionare"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 2h12l3 7H3l3-7z" />
                        <path d="M3 9h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                        <path d="M8 13h8" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/aprovizionare/receptii"
                    label="Recepții"
                    description="GRN / intrări stoc"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
                        <path d="M8 12h8" />
                        <path d="M12 8v8" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/aprovizionare/facturi"
                    label="Facturi furnizor"
                    description="AP / plăți furnizori"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2z" />
                        <path d="M8 8h8" />
                        <path d="M8 12h8" />
                        <path d="M8 16h5" />
                      </svg>
                    }
                  />
                </NavGroup>
              ) : null}

              {/* ACCES */}
              {isAdmin ? (
                <NavGroup title="Acces" defaultOpen={false}>
                  <NavItem
                    href="/admin/agenti"
                    label="Agenți"
                    description="Conturi agent vânzări"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M19 8v6" />
                        <path d="M22 11h-6" />
                      </svg>
                    }
                  />
                  <NavItem
                    href="/admin/setari"
                    label="Setări magazin"
                    description="Configurări generale"
                    icon={
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-5 w-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                        <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-6l-.4 2.5a8 8 0 0 0-1.7 1L4.5 6 2.5 9.5 4.5 11a7.9 7.9 0 0 0 .1 2L2.5 14.5l2 3.5 2.4-1a8 8 0 0 0 1.7 1L9 21h6l.4-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5z" />
                      </svg>
                    }
                  />
                </NavGroup>
              ) : null}
            </nav>
          </div>

          <div className="border-t border-slate-200 px-4 py-4">
            <div className="text-xs font-semibold text-slate-700">Autentificat ca</div>
            <div className="mt-1 truncate text-sm text-slate-900">{user.email}</div>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="w-full rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Deconectare
              </button>
            </form>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-50 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-slate-900">
                  Portal administrare
                </div>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 sm:inline-flex">
                  Rol: {roleLabel}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="hidden text-slate-500 sm:inline">{user.email}</span>
                <form action="/api/auth/logout" method="post" className="md:hidden">
                  <button
                    type="submit"
                    className="rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Deconectare
                  </button>
                </form>
              </div>
            </div>
          </div>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}