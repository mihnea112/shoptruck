import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

export const metadata = {
  title: "Politica de cookie-uri · ShopTruck",
};

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Politica de cookie-uri">
      <h2>Ce sunt cookie-urile?</h2>
      <p>
        Cookie-urile sunt mici fragmente de informații salvate de browserul
        dumneavoastră. Cookie-urile sunt folosite pentru a vă aminti diferite
        aspecte ale vizitei dumneavoastră pe site.
      </p>

      <h2>Cum utilizăm cookie-urile</h2>
      <p>
        www.shoptruck.ro utilizează cookie-uri pentru a facilita și îmbunătăți
        experiența dumneavoastră de navigare. Site-ul www.shoptruck.ro{" "}
        <strong>nu folosește cookie-urile pentru a salva informații personale
        pentru utilizări externe</strong>.
      </p>

      <h2>Tipuri de cookie-uri utilizate</h2>
      <table>
        <thead>
          <tr>
            <th>Tip</th>
            <th>Scop</th>
            <th>Durată</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cookie-uri de sesiune</td>
            <td>Autentificare, coș de cumpărături</td>
            <td>Se șterg la închiderea browserului</td>
          </tr>
          <tr>
            <td>Cookie-uri funcționale</td>
            <td>Preferințe de navigare, limba</td>
            <td>Până la 1 an</td>
          </tr>
          <tr>
            <td>Cookie-uri analitice</td>
            <td>Statistici anonime de utilizare</td>
            <td>Până la 2 ani</td>
          </tr>
        </tbody>
      </table>

      <h2>Controlul cookie-urilor</h2>
      <p>
        Cele mai multe browsere sunt setate automat pentru a accepta
        cookie-urile, dar de obicei puteți modifica setările browserului
        dumneavoastră pentru a preveni acceptarea automată. Dezactivarea
        cookie-urilor poate afecta funcționalitatea unor secțiuni ale site-ului.
      </p>

      <h2>Mai multe informații</h2>
      <p>
        Pentru informații suplimentare despre cookie-uri, puteți vizita{" "}
        <a
          href="https://www.allaboutcookies.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.allaboutcookies.org
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
