import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

export const metadata = {
  title: "Politica de retur · ShopTruck",
};

export default function ReturnsPage() {
  return (
    <LegalPageLayout title="Politica de retur">
      <h2>Dreptul de retur</h2>
      <p>
        Magazinul nostru are obligația legală să accepte returul produselor în{" "}
        <strong>14 zile</strong> de la livrare, conform OUG 34/2014 privind
        drepturile consumatorilor.
      </p>

      <h2>Costul transportului</h2>
      <p>
        Costul transportului aferent returului va fi suportat de către client,
        cu excepția cazului în care produsul livrat este defect sau diferit de
        cel comandat.
      </p>

      <h2>Condiții de retur</h2>
      <ul>
        <li>
          Produsele trebuie returnate în ambalajul original, nedeteriorate și
          nefolosite
        </li>
        <li>
          Returul trebuie solicitat în maximum 14 zile calendaristice de la
          primirea produsului
        </li>
        <li>
          Produsele trebuie însoțite de factura sau bonul fiscal original
        </li>
        <li>
          Produsele personalizate sau realizate la comandă nu pot fi returnate
        </li>
      </ul>

      <h2>Procesul de retur</h2>
      <p>
        Dacă o problemă cu un produs nu poate fi rezolvată de departamentul
        tehnic sau de vânzări, puteți iniția un retur contactându-ne cu
        următoarele informații:
      </p>
      <ul>
        <li>Numărul comenzii</li>
        <li>Produsele care se returnează</li>
        <li>
          Motivul returului (produs defect la primire, produs greșit primit,
          alt motiv)
        </li>
        <li>
          Starea produsului (sigilat ca la primire sau folosit/instalat)
        </li>
        <li>Datele personale (nume, e-mail, telefon)</li>
        <li>Metoda de rambursare (transfer bancar — IBAN)</li>
        <li>Opțional: copie factură sau bon fiscal</li>
      </ul>

      <h2>Rambursarea</h2>
      <p>
        Rambursarea se va efectua prin transfer bancar în contul specificat de
        client, în termen de maximum <strong>14 zile</strong> de la primirea
        produselor returnate și verificarea stării acestora.
      </p>

      <h2>Contact retur</h2>
      <p>
        Pentru a iniția un retur, contactați-ne la:{" "}
        <a href="mailto:office@autotruck.ro">office@autotruck.ro</a> sau la
        telefon <a href="tel:0256244136">0256/244136</a>.
      </p>
    </LegalPageLayout>
  );
}
