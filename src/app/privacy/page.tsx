import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

export const metadata = {
  title: "Politica de confidențialitate · ShopTruck",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Politica de confidențialitate">
      <h2>Introducere</h2>
      <p>
        <strong>SC AUTO-TRUCK SRL</strong> (denumit în continuare
        &quot;Operatorul&quot;) respectă confidențialitatea datelor
        dumneavoastră personale în conformitate cu Regulamentul (UE) 2016/679
        (GDPR) și legislația națională aplicabilă.
      </p>
      <p>
        Această politică descrie modul în care colectăm, utilizăm, stocăm și
        protejăm datele dumneavoastră personale atunci când utilizați site-ul
        www.shoptruck.ro.
      </p>

      <h2>Datele pe care le colectăm</h2>
      <p>Colectăm următoarele categorii de date personale:</p>
      <ul>
        <li>
          <strong>Date de identificare:</strong> nume, prenume, adresă de
          e-mail, număr de telefon
        </li>
        <li>
          <strong>Date de facturare:</strong> denumire firmă, CUI/CIF, nr.
          registru comerțului, adresă sediu
        </li>
        <li>
          <strong>Date de livrare:</strong> adresă de livrare, oraș, cod poștal,
          persoană de contact
        </li>
        <li>
          <strong>Date de cont:</strong> adresă e-mail, parolă (stocată
          criptat), istoric comenzi
        </li>
        <li>
          <strong>Date tehnice:</strong> adresă IP, tip browser, cookie-uri de
          sesiune
        </li>
      </ul>

      <h2>Scopul prelucrării</h2>
      <ul>
        <li>Procesarea și livrarea comenzilor</li>
        <li>Emiterea facturilor și documentelor fiscale</li>
        <li>Comunicarea privind statusul comenzilor</li>
        <li>Gestionarea contului de utilizator</li>
        <li>Răspunsul la solicitări și reclamații</li>
        <li>Trimiterea de comunicări comerciale (doar cu consimțământ)</li>
        <li>Îmbunătățirea serviciilor și a experienței de navigare</li>
      </ul>

      <h2>Temeiul legal al prelucrării</h2>
      <ul>
        <li>
          <strong>Executarea contractului</strong> — pentru procesarea
          comenzilor, livrare și facturare
        </li>
        <li>
          <strong>Obligație legală</strong> — pentru păstrarea documentelor
          fiscale conform legislației
        </li>
        <li>
          <strong>Consimțământ</strong> — pentru comunicări de marketing
        </li>
        <li>
          <strong>Interes legitim</strong> — pentru securitatea site-ului și
          prevenirea fraudei
        </li>
      </ul>

      <h2>Securitatea datelor</h2>
      <p>
        Toate datele personale sunt protejate prin măsuri tehnice adecvate:
      </p>
      <ul>
        <li>Transmisie criptată prin HTTPS/TLS</li>
        <li>Parolele sunt stocate folosind algoritmul de hashing Argon2</li>
        <li>Acces restricționat la baza de date pe baza rolurilor</li>
        <li>Backup-uri regulate criptate</li>
        <li>Monitorizare continuă a securității</li>
      </ul>

      <h2>Partajarea datelor</h2>
      <p>
        Nu vindem, nu închiriem și nu partajăm datele dumneavoastră personale
        cu terți, cu excepția:
      </p>
      <ul>
        <li>Serviciilor de curierat pentru livrarea comenzilor</li>
        <li>Autorităților competente, la cerere legală</li>
        <li>Furnizorilor de servicii IT (hosting, e-mail) — în baza unor
          contracte de prelucrare a datelor</li>
      </ul>

      <h2>Drepturile dumneavoastră</h2>
      <p>
        Aveți dreptul de acces, rectificare, ștergere, restricționare,
        portabilitate și opoziție. Detalii complete în{" "}
        <a href="/gdpr">pagina GDPR</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Responsabil protecția datelor: Zgurai Claudia Mădălina<br />
        E-mail:{" "}
        <a href="mailto:claudia@autotruck.ro">claudia@autotruck.ro</a><br />
        Telefon: <a href="tel:0256244136">0256/244136</a>
      </p>

      <p className="text-xs text-slate-500 mt-8">
        Ultima actualizare: Septembrie 2026
      </p>
    </LegalPageLayout>
  );
}
