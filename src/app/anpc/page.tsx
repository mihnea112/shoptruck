import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

export const metadata = {
  title: "ANPC · ShopTruck",
};

export default function ANPCPage() {
  return (
    <LegalPageLayout title="ANPC — Protecția consumatorilor">
      <h2>Autoritatea Națională pentru Protecția Consumatorilor</h2>
      <p>
        În cazul în care aveți o problemă, <strong>ANPC</strong> vă poate ajuta
        să o rezolvați, dacă este vorba de un caz reglementat de legislația
        privind protecția consumatorului.
      </p>

      <h2>Soluționarea alternativă a litigiilor (SAL)</h2>
      <p>
        Conform legislației în vigoare, consumatorii pot recurge la proceduri de
        soluționare alternativă a litigiilor. Puteți depune o plângere online
        folosind următoarele platforme:
      </p>

      <div className="space-y-4 my-6">
        <a
          href="https://anpc.ro/ce-este-sal/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition no-underline"
        >
          <span className="text-2xl">🏛️</span>
          <div>
            <p className="font-semibold text-slate-900 !mb-0">
              ANPC — Soluționarea alternativă a litigiilor
            </p>
            <p className="text-xs text-slate-700 !mb-0">anpc.ro/ce-este-sal</p>
          </div>
        </a>

        <a
          href="https://solutionare.anpc.gov.ro/WebForm/Landing"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition no-underline"
        >
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-semibold text-slate-900 !mb-0">
              Formular de reclamație online ANPC
            </p>
            <p className="text-xs text-slate-700 !mb-0">
              solutionare.anpc.gov.ro
            </p>
          </div>
        </a>

        <a
          href="https://ec.europa.eu/consumers/odr/main/index.cfm?event=main.home2.show&lng=RO"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition no-underline"
        >
          <span className="text-2xl">🇪🇺</span>
          <div>
            <p className="font-semibold text-slate-900 !mb-0">
              Platforma europeană ODR
            </p>
            <p className="text-xs text-slate-700 !mb-0">
              Soluționarea online a disputelor la nivel european
            </p>
          </div>
        </a>
      </div>

      <h2>Date de contact operator</h2>
      <p>
        <strong>SC AUTO-TRUCK SRL</strong><br />
        Str. Miresei Nr. 12A, Timișoara, Jud. Timiș<br />
        CUI: RO14084923 · Reg. Com: J35/838/2001<br />
        Tel: <a href="tel:0256244136">0256/244136</a><br />
        E-mail: <a href="mailto:office@autotruck.ro">office@autotruck.ro</a>
      </p>
    </LegalPageLayout>
  );
}
