import Link from "next/link";

export function MainFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      {/* Main Footer Content */}
      <div className="w-full px-6 py-12 lg:px-10 xl:px-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">ShopTruck.ro</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="leading-relaxed">
                Piese și componente originale pentru camioane și vehicule comerciale.
              </p>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-700">Adresă:</p>
                  <p>Str. Miresei Nr. 12A<br />TIMIS, TIMISOARA</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Contact:</p>
                  <p>
                    <a href="tel:0256244136" className="hover:text-blue-600">
                      Tel: 0256 244 136
                    </a>
                  </p>
                  <p>
                    <a href="mailto:office@autotruck.ro" className="hover:text-blue-600">
                      office@autotruck.ro
                    </a>
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">CIF: RO14084923</p>
                  <p>Reg. Com: J35/838/2001</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Suport Client</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/contact" className="hover:text-blue-600 transition">
                  Contactează-ne
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-blue-600 transition">
                  Întrebări frecvente
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-blue-600 transition">
                  Politica de livrare
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-blue-600 transition">
                  Politica de retur
                </Link>
              </li>
              <li>
                <Link href="/track-order" className="hover:text-blue-600 transition">
                  Urmărește comanda
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Legal</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/terms" className="hover:text-blue-600 transition">
                  Termeni și condiții
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-blue-600 transition">
                  Politica de confidențialitate
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-blue-600 transition">
                  Politica de cookie-uri
                </Link>
              </li>
              <li>
                <Link href="/gdpr" className="hover:text-blue-600 transition">
                  GDPR & Date personale
                </Link>
              </li>
              <li>
                <Link href="/complaints" className="hover:text-blue-600 transition">
                  Procedura reclamații
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Compliance */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Protecția Consumatorilor</h3>
            <div className="space-y-3">
              <a
                href="https://solutionare.anpc.gov.ro/WebForm/Landing"
                target="_blank"
                rel="noopener noreferrer"
                className="block group hover:opacity-90 transition"
                title="ANPC - Soluționarea alternativă a litigiilor"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/anpc-alternativa.png"
                  alt="ANPC - Soluționarea alternativă a litigiilor"
                  className="h-20 w-auto"
                />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="w-full px-6 py-6 lg:px-10 xl:px-16 text-xs text-slate-500">
          <p>
            © {currentYear} <span className="font-semibold text-slate-600">ShopTruck.ro</span> · Toate drepturile rezervate
          </p>
        </div>
      </div>
    </footer>
  );
}
