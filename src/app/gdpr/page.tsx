import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

export const metadata = {
  title: "GDPR · ShopTruck",
};

export default function GDPRPage() {
  return (
    <LegalPageLayout title="GDPR — Protecția datelor personale">
      <h2>Operator date cu caracter personal</h2>
      <p>
        <strong>SC AUTO-TRUCK S.R.L.</strong><br />
        Sediu: Str. Miresei Nr. 12A, Timișoara, Jud. Timiș<br />
        CUI: RO14084923 · Reg. Com: J35/838/2001
      </p>

      <h2>Responsabil protecția datelor (DPO)</h2>
      <p>
        Zgurai Claudia Mădălina<br />
        E-mail:{" "}
        <a href="mailto:claudia@autotruck.ro">claudia@autotruck.ro</a>
      </p>

      <h2>Ce date personale colectăm</h2>
      <p>
        Colectăm și prelucrăm doar datele personale strict necesare pentru
        scopurile descrise mai jos. Toate datele personale sunt stocate în
        formă criptată și transmise prin conexiuni securizate (HTTPS/TLS).
      </p>

      <table>
        <thead>
          <tr>
            <th>Categorie</th>
            <th>Date colectate</th>
            <th>Scop</th>
            <th>Temei legal</th>
            <th>Perioadă retenție</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Date clienți</td>
            <td>Nume, adresă, telefon, e-mail, CUI/CIF</td>
            <td>Livrarea produselor, facturare, contact client</td>
            <td>Executarea contractului</td>
            <td>10 ani (obligație fiscală)</td>
          </tr>
          <tr>
            <td>Date cont online</td>
            <td>E-mail, parolă criptată, istoric comenzi</td>
            <td>Gestionarea contului, procesarea comenzilor</td>
            <td>Executarea contractului</td>
            <td>Pe durata existenței contului + 3 ani</td>
          </tr>
          <tr>
            <td>Comunicări marketing</td>
            <td>Nume, e-mail</td>
            <td>Trimiterea de oferte și promoții</td>
            <td>Consimțământ</td>
            <td>Până la retragerea consimțământului</td>
          </tr>
          <tr>
            <td>Reclamații</td>
            <td>Nume, e-mail, telefon, detalii reclamație</td>
            <td>Soluționarea reclamațiilor</td>
            <td>Obligație legală</td>
            <td>5 ani</td>
          </tr>
          <tr>
            <td>Date navigare</td>
            <td>Adresă IP, cookie-uri, date browser</td>
            <td>Funcționalitatea site-ului, securitate</td>
            <td>Interes legitim</td>
            <td>30 zile</td>
          </tr>
        </tbody>
      </table>

      <h2>Drepturile dumneavoastră</h2>
      <p>
        Conform Regulamentului (UE) 2016/679 (GDPR), aveți următoarele
        drepturi cu privire la datele personale:
      </p>
      <ul>
        <li>
          <strong>Dreptul de acces</strong> — puteți solicita confirmarea
          prelucrării datelor și o copie a acestora
        </li>
        <li>
          <strong>Dreptul la rectificare</strong> — puteți solicita corectarea
          datelor inexacte
        </li>
        <li>
          <strong>Dreptul la ștergere</strong> — puteți solicita ștergerea
          datelor, cu excepția celor păstrate prin obligație legală
        </li>
        <li>
          <strong>Dreptul la restricționarea prelucrării</strong> — puteți
          solicita limitarea prelucrării în anumite condiții
        </li>
        <li>
          <strong>Dreptul la portabilitate</strong> — puteți solicita
          transmiterea datelor către alt operator
        </li>
        <li>
          <strong>Dreptul la opoziție</strong> — vă puteți opune prelucrării
          datelor în scopuri de marketing direct
        </li>
        <li>
          <strong>Dreptul de a depune plângere</strong> — la Autoritatea
          Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal
          (ANSPDCP):{" "}
          <a
            href="https://www.dataprotection.ro"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.dataprotection.ro
          </a>
        </li>
      </ul>

      <h2>Măsuri de securitate</h2>
      <p>
        Am implementat următoarele măsuri tehnice și organizatorice pentru
        protecția datelor personale:
      </p>
      <ul>
        <li>Criptarea datelor personale în tranzit (TLS/HTTPS) și în repaus</li>
        <li>Acces restricționat la datele personale pe baza rolurilor</li>
        <li>Parolele utilizatorilor sunt stocate folosind algoritmi de hashing securizați (Argon2)</li>
        <li>Monitorizarea și auditarea accesului la datele personale</li>
        <li>Backup-uri regulate ale bazelor de date, criptate</li>
        <li>Actualizarea periodică a sistemelor și a politicilor de securitate</li>
        <li>Instruirea personalului cu privire la protecția datelor</li>
        <li>Proceduri de notificare a breșelor de securitate în 72h</li>
      </ul>

      <h2>Transferuri internaționale</h2>
      <p>
        Datele personale sunt stocate pe servere situate în Uniunea Europeană.
        Nu transferăm date personale în afara Spațiului Economic European fără
        garanții adecvate conform GDPR.
      </p>

      <h2>Exercitarea drepturilor</h2>
      <p>
        Pentru orice solicitare legată de datele dumneavoastră personale, ne
        puteți contacta la{" "}
        <a href="mailto:claudia@autotruck.ro">claudia@autotruck.ro</a> sau
        prin poștă la adresa sediului social. Vom răspunde în maximum 30 de
        zile de la primirea cererii.
      </p>

      <h2>Modificări ale politicii</h2>
      <p>
        Ne rezervăm dreptul de a actualiza această politică. Modificările vor fi
        publicate pe această pagină cu data ultimei actualizări.
      </p>

      <p className="text-xs text-slate-500 mt-8">
        Ultima actualizare: Septembrie 2026
      </p>
    </LegalPageLayout>
  );
}
