import { LegalPageLayout } from "@/components/layout/LegalPageLayout";

export const metadata = {
  title: "Termeni și condiții · ShopTruck",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Termeni și condiții">
      <p>
        Bine ați venit pe site-ul <strong>www.shoptruck.ro</strong>, deținut de{" "}
        <strong>SC AUTO-TRUCK SRL</strong>, cu sediu în Timișoara, județul Timiș,
        Strada Miresei, nr. 12A, înregistrată în Registrul Comerțului sub nr.{" "}
        <strong>J35/838/2001</strong>, având cod unic de înregistrare{" "}
        <strong>RO14084923</strong>.
      </p>

      <p>Ne puteți contacta prin următoarele mijloace:</p>
      <ul>
        <li>Prin poștă la adresa: Strada Miresei, nr. 12A, Timișoara</li>
        <li>
          Prin e-mail la adresa:{" "}
          <a href="mailto:office@autotruck.ro">office@autotruck.ro</a>
        </li>
        <li>
          Prin telefon/fax la numărul:{" "}
          <a href="tel:0256244136">0256/244136</a>
        </li>
      </ul>

      <p>
        www.shoptruck.ro este un serviciu de vânzări online care oferă
        utilizatorilor săi posibilitatea de a intra în posesia produselor
        afișate pe baza comenzilor primite prin site cât și a comenzilor date pe
        e-mail.
      </p>

      <h2>Acceptarea condițiilor</h2>
      <p>
        Prin accesarea acestui site web și/sau a oricărei pagini a acestuia
        sunteți de acord cu aceste condiții de utilizare. Dacă nu sunteți de
        acord cu acești termeni și condiții de utilizare nu accesați acest site.
        De asemenea vă sfătuim să citiți și{" "}
        <a href="/privacy">Politica de confidențialitate</a> cât și{" "}
        <a href="/returns">Politica de garanție, service și retur</a>.
      </p>

      <h2>Descrierea serviciilor</h2>
      <p>
        www.shoptruck.ro pune la dispoziție informațiile din acest site web în
        scop informativ general și nu garantează exactitatea lor la un moment
        dat, deși se va încerca pe cât posibil ca la publicarea lor pe site
        toate informațiile să fie exacte.
      </p>

      <h2>Neangajarea răspunderii</h2>
      <p>
        www.shoptruck.ro nu poate fi făcut răspunzător în nici un fel de
        pierderile sau daunele pe care cineva le-ar putea suferi ca urmare a
        folosirii în vreun fel a informațiilor prezentate în acest site web.
      </p>
      <p>
        www.shoptruck.ro nu garantează în nici un fel acuratețea, gradul de
        utilitate sau caracterul complet al informațiilor sau al materialelor
        cuprinse în acest site. www.shoptruck.ro nu garantează rezultatele ce
        s-ar putea obține din utilizarea informațiilor prezentate prin
        intermediul acestui site și nici disponibilitatea spre folosire a
        oricăror informații prezente pe site.
      </p>
      <p>
        www.shoptruck.ro nu își asumă nicio responsabilitate pentru conținutul
        niciunui material (contract) prezentat pe acest site. Acestea sunt
        prezentate în scop informativ, nu în scop comercial.
      </p>

      <h2>Reguli generale</h2>
      <p>
        Orice utilizator care vizitează acest site o face pe propria
        răspundere. Materialele și informațiile conținute în acest site sunt
        furnizate în scop de informare generală, nefiind însoțite de niciun
        fel de garanții, explicite sau implicite.
      </p>

      <h2>Limitări de ordin tehnic ale serviciilor</h2>
      <p>
        www.shoptruck.ro nu își asumă nicio responsabilitate în cazul în care
        serviciile site-ului nu pot fi accesate de către utilizatori, pe o
        perioadă nelimitată/nedeterminată de timp, din orice motive tehnice sau
        comerciale.
      </p>

      <h2>Încheierea acordului</h2>
      <p>
        www.shoptruck.ro își rezervă dreptul de a schimba termenii, condițiile
        și politicile în orice moment fără a anunța în prealabil, prin urmare
        sunteți rugat să revedeți în mod regulat această secțiune pentru a fi la
        curent cu modificările aduse.
      </p>
      <p>
        Ne rezervăm dreptul de a refuza orice comandă care este suspectă din
        punct de vedere tehnic.
      </p>
    </LegalPageLayout>
  );
}
