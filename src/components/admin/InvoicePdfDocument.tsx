import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
} from "@react-pdf/renderer";

/* ── Sanitize diacritics (Helvetica has none) ── */
function s(v: any): string {
  if (v == null) return "";
  return String(v)
    .replace(/[ăĂ]/g, "a")
    .replace(/[âÂ]/g, "a")
    .replace(/[îÎ]/g, "i")
    .replace(/[șşŞȘ]/g, "s")
    .replace(/[țţŢȚ]/g, "t")
    .replace(/[éèêëÉÈÊË]/g, "e")
    .replace(/[àáäÀÁÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[—–]/g, "-")
    .replace(/[""„"]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[…]/g, "...");
}

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Styles matching the invoice model ── */
const st = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#000",
    backgroundColor: "#fff",
  },

  // Header with furnizor + cumparator
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerCol: { width: "48%" },
  headerLabel: { fontSize: 9, color: "#333", marginBottom: 2 },
  headerCompany: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  headerDetail: { fontSize: 8, color: "#333", marginBottom: 1 },

  // Title block
  titleBlock: { textAlign: "center", marginBottom: 12, marginTop: 8 },
  titleMain: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  titleSub: { fontSize: 10, marginTop: 2 },

  // Tax & plate row
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaText: { fontSize: 9 },

  // Table
  table: { borderWidth: 1, borderColor: "#000", marginBottom: 6 },
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    backgroundColor: "#f0f0f0",
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    minHeight: 18,
    alignItems: "center",
  },
  tCell: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: "#ccc",
  },
  tCellHead: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#999",
  },

  // Column widths
  colNr: { width: "5%" },
  colName: { width: "40%" },
  colUm: { width: "8%" },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "13%", textAlign: "right" },
  colValue: { width: "12%", textAlign: "right" },
  colTva: { width: "12%", textAlign: "right" },

  // Footer info
  deliveryPayment: { fontSize: 8, marginBottom: 2, fontFamily: "Helvetica-Bold" },
  dueDate: { fontSize: 8, marginTop: 4, fontFamily: "Helvetica-Bold" },
  disclaimer: { fontSize: 7, marginTop: 6, color: "#333" },
  disclaimerBold: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#333" },

  // Bottom section
  bottomRow: {
    flexDirection: "row",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingTop: 6,
  },
  bottomCol: { width: "33%" },
  bottomLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  bottomText: { fontSize: 7, marginBottom: 1 },
  totalBox: {
    alignItems: "flex-end",
    width: "34%",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 180,
    marginBottom: 2,
  },
  totalLabel: { fontSize: 9 },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalFinal: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },

  // Page 2
  p2Title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 14 },
  p2SubTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 20, marginBottom: 10 },
  p2Text: { fontSize: 8, lineHeight: 1.5, marginBottom: 4 },
  p2Bullet: { fontSize: 8, marginLeft: 20, marginBottom: 2 },
  p2Section: { marginBottom: 12 },
  p2LocationTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 16, marginBottom: 8 },
  p2Location: { fontSize: 8, marginBottom: 2 },
  p2LocationBold: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  receptLine: { fontSize: 8, marginTop: 4 },
});

/* ── COMPANY INFO (furnizor) — static ── */
const FURNIZOR = {
  name: "SC AUTO-TRUCK S.R.L.",
  regNo: "Nr.ord.Reg.Com./an: J35/838/2001",
  cif: "CIF: RO14084923",
  address: "Sediu: Str.MIRESEI Nr.12A",
  phone: "Telefon / Fax: 0256/244136",
  mobile: "Mobil: 0721850598",
  county: "Judetul: Timis",
  capital: "Capital social: 50000 RON",
  bank1: "Banca: ING BANK Timisoara",
  iban1: "Cod IBAN: RO54 INGB 0002 0081 8229 8911",
  bank2: "Banca: TRANSILVANIA Timisoara",
  iban2: "Cod IBAN:RO66 BTRL 0360 1202 6102 88XX",
};

export type InvoiceData = {
  invoiceType: "definitiva" | "proforma";
  series: string;
  number: number;
  invoiceDate: string;
  dueDate: string | null;
  taxRatePct: number;
  deliveryMethod: string;
  paymentMethod: string;
  plateNo: string;

  customer: {
    display_name: string;
    vat_id?: string | null;
    reg_no?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    county?: string | null;
  };

  items: Array<{
    code: string;
    name: string;
    uom: string;
    quantity: number;
    unitPriceNet: number;
    lineNet: number;
    lineTax: number;
  }>;

  totalNet: number;
  totalTax: number;
  totalGross: number;

  delegatName?: string;
  delegatId?: string;
  delegatIssuedBy?: string;
  transportLocation?: string;
  transportDateTime?: string;
};

export default function InvoicePdfDocument({ data }: { data: InvoiceData }) {
  const isProforma = data.invoiceType === "proforma";
  const title = isProforma ? "FACTURA PROFORMA" : "FACTURA FISCALA";

  return (
    <Document>
      {/* ═══════ PAGE 1: INVOICE ═══════ */}
      <Page size="A4" style={st.page}>
        {/* Header: Furnizor + Cumparator */}
        <View style={st.headerRow}>
          <View style={st.headerCol}>
            <Text style={st.headerLabel}>Furnizor:</Text>
            <Text style={st.headerCompany}>{FURNIZOR.name}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.regNo}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.cif}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.address}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.phone}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.mobile}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.county}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.capital}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.bank1}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.iban1}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.bank2}</Text>
            <Text style={st.headerDetail}>{FURNIZOR.iban2}</Text>
          </View>
          <View style={st.headerCol}>
            <Text style={st.headerLabel}>Cumparator:</Text>
            <Text style={st.headerCompany}>{s(data.customer.display_name)}</Text>
            {data.customer.reg_no && (
              <Text style={st.headerDetail}>Nr.ord.Reg.Com./an: {data.customer.reg_no}</Text>
            )}
            {data.customer.vat_id && (
              <Text style={st.headerDetail}>CIF: {data.customer.vat_id}</Text>
            )}
            {data.customer.address && (
              <Text style={st.headerDetail}>Sediu: {s(data.customer.address)}</Text>
            )}
            {data.customer.city && (
              <Text style={st.headerDetail}>Localitatea: {s(data.customer.city)}</Text>
            )}
            {data.customer.county && (
              <Text style={st.headerDetail}>Judetul: {s(data.customer.county)}</Text>
            )}
            {data.customer.phone && (
              <Text style={st.headerDetail}>Tel: {data.customer.phone}</Text>
            )}
            {data.customer.email && (
              <Text style={st.headerDetail}>{data.customer.email}</Text>
            )}
            <Text style={st.headerDetail}>{"\n"}Banca:</Text>
            <Text style={st.headerDetail}>Cod IBAN:</Text>
          </View>
        </View>

        {/* Title */}
        <View style={st.titleBlock}>
          <Text style={st.titleMain}>{title}</Text>
          <Text style={st.titleSub}>Seria: {data.series}</Text>
          <Text style={st.titleSub}>Nr.: {data.number}</Text>
          <Text style={st.titleSub}>Data: {data.invoiceDate}</Text>
        </View>

        {/* Tax rate + Plate */}
        <View style={st.metaRow}>
          <Text style={st.metaText}>Cota TVA {data.taxRatePct}%</Text>
          <Text style={st.metaText}>Nr. Inmatriculare: {s(data.plateNo || "")}</Text>
        </View>

        {/* Products table */}
        <View style={st.table}>
          {/* Header */}
          <View style={st.tHead}>
            <Text style={[st.tCellHead, st.colNr]}>Nr.{"\n"}Crt.</Text>
            <Text style={[st.tCellHead, st.colName]}>Denumirea Produselor{"\n"}sau a serviciilor</Text>
            <Text style={[st.tCellHead, st.colUm]}>U.M.</Text>
            <Text style={[st.tCellHead, st.colQty]}>Cantitatea</Text>
            <Text style={[st.tCellHead, st.colPrice]}>Pret unitar{"\n"}(fara TVA){"\n"}- lei -</Text>
            <Text style={[st.tCellHead, st.colValue]}>Valoare{"\n"}- lei -</Text>
            <Text style={[st.tCellHead, st.colTva]}>Valoare TVA{"\n"}- lei -</Text>
          </View>

          {/* Column numbers row */}
          <View style={st.tRow}>
            <Text style={[st.tCell, st.colNr, { textAlign: "center" }]}>0</Text>
            <Text style={[st.tCell, st.colName, { textAlign: "center" }]}>1</Text>
            <Text style={[st.tCell, st.colUm, { textAlign: "center" }]}>2</Text>
            <Text style={[st.tCell, st.colQty]}>3</Text>
            <Text style={[st.tCell, st.colPrice]}>4</Text>
            <Text style={[st.tCell, st.colValue]}>5 (3x4)</Text>
            <Text style={[st.tCell, st.colTva]}>6</Text>
          </View>

          {/* Data rows */}
          {data.items.map((item, idx) => (
            <View key={idx} style={st.tRow}>
              <Text style={[st.tCell, st.colNr, { textAlign: "center" }]}>{idx + 1}.</Text>
              <Text style={[st.tCell, st.colName]}>
                {s(item.code ? `${item.code} - ${item.name}` : item.name)}
              </Text>
              <Text style={[st.tCell, st.colUm, { textAlign: "center" }]}>{item.uom}</Text>
              <Text style={[st.tCell, st.colQty]}>{fmt(item.quantity)}</Text>
              <Text style={[st.tCell, st.colPrice]}>{fmt(item.unitPriceNet)}</Text>
              <Text style={[st.tCell, st.colValue]}>{fmt(item.lineNet)}</Text>
              <Text style={[st.tCell, st.colTva]}>{fmt(item.lineTax)}</Text>
            </View>
          ))}
        </View>

        {/* Delivery & Payment */}
        <Text style={st.deliveryPayment}>
          Modalitate de livrare: {s(data.deliveryMethod)}
        </Text>
        <Text style={st.deliveryPayment}>
          Modalitate de plata: {s(data.paymentMethod)}
        </Text>

        {/* Due date */}
        {data.dueDate && (
          <Text style={st.dueDate}>DATA SCADENTA: {data.dueDate}</Text>
        )}

        {/* Disclaimers */}
        <Text style={[st.disclaimer, { marginTop: 8, fontFamily: "Helvetica-Oblique" }]}>
          Certificatul de garantie aferent produselor facturate se afla pe verso-ul facturii fiscale.
        </Text>
        <Text style={[st.disclaimer, { marginTop: 6 }]}>
          Toate reperele de pe factura au fost VERIFICATE SI ACCEPTATE CANTITATIV SI CALITATIV de beneficiar.
        </Text>
        <Text style={st.disclaimerBold}>
          !!! Atentie !!! Componentele de caroserie - ex. parbriz, far, sticla far - orice defecte, fisuri sau crapaturi
        </Text>
        <Text style={st.disclaimerBold}>
          CONSTATATE ULTERIOR RECEPTIEI nu mai pot face obiectul inlocuirii sau garantiei.
        </Text>

        <Text style={st.receptLine}>Receptionat ...................</Text>

        {/* Bottom: signatures + totals */}
        <View style={st.bottomRow}>
          <View style={st.bottomCol}>
            <Text style={st.bottomLabel}>Semnatura si stampila</Text>
            <Text style={st.bottomText}>furnizorului</Text>
          </View>
          <View style={st.bottomCol}>
            <Text style={st.bottomLabel}>Delegat: {s(data.delegatName || "")}</Text>
            {data.delegatId && <Text style={st.bottomText}>Buletin/C.I.: {data.delegatId}</Text>}
            {data.delegatIssuedBy && <Text style={st.bottomText}>Emis de:{data.delegatIssuedBy}</Text>}
            {data.transportLocation && <Text style={st.bottomText}>Mijlocul de transport:</Text>}
            {data.transportDateTime && <Text style={st.bottomText}>Data:{data.transportDateTime}</Text>}
            <Text style={st.bottomText}>Semnaturile predare primire marfa:</Text>
          </View>
          <View style={st.totalBox}>
            <Text style={st.bottomLabel}>Semnatura</Text>
            <Text style={st.bottomText}>de primire</Text>
            <Text style={st.bottomText}>factura</Text>
            <View style={[st.totalLine, { marginTop: 6 }]}>
              <Text style={st.totalLabel}>Valoare: </Text>
              <Text style={st.totalValue}>{fmt(data.totalNet)}</Text>
            </View>
            <View style={st.totalLine}>
              <Text style={st.totalLabel}>Val.TVA: </Text>
              <Text style={st.totalValue}>{fmt(data.totalTax)}</Text>
            </View>
            <Text style={st.totalFinal}>TOTAL DE PLATA: {fmt(data.totalGross)} LEI</Text>
          </View>
        </View>
      </Page>

      {/* ═══════ PAGE 2: DECLARATIE + GARANTIE (static, untouched) ═══════ */}
      <Page size="A4" style={st.page}>
        <Text style={st.p2Title}>DECLARATIE DE CONFORMITATE</Text>
        <View style={st.p2Section}>
          <Text style={st.p2Text}>
            S.C. AUTO-TRUCK S.R.L. cu sediul in TIMISOARA, str. MIRESEI, nr. 12A, CP300642, jud. Timis, Tel/Fax: 0256-244136, Cod Fiscal: RO14084923, numar inregistrare la Registrul Comertului Timis: J35/838/2001, asiguram si declaram pe propria raspundere, conform cu prevederile din H.G. nr. 1022/2002 privind regimul produselor si serviciilor care pot pune in pericol viata, sanatatea, securitatea muncii si protectia mediului, ca produsele comercializate de noi, la care se refera aceasta declaratie, nu pun in pericol viata, sanatatea, securitatea muncii, nu produc un impact negativ asupra mediului si sunt in conformitate cu specificatiile tehnice ale producatorului.
          </Text>
        </View>

        <Text style={st.p2SubTitle}>CERTIFICAT DE GARANTIE</Text>
        <View style={st.p2Section}>
          <Text style={st.p2Text}>
            Pentru produsele cuprinse in prezenta factura, se acorda garantie in conformitate cu Legea 449/2003 republicata, precum si cu O.G. 21/1992 republicata, cu modificarile si completarile ulterioare. Termenul de garantie oferit de producator este de 2 ani si incepe sa curga de la data livrarii produsului. Daca insa, durata medie de utilizare a produsului este mai mica de 2 ani, atunci termenul de garantie se reduce in mod corespunzator. Produsele care prezinta in perioada de garantie, defecte de material sau de fabricatie vor fi inlocuite cu altele. Cumparatorul va informa vanzatorul in termen de maxim 2 luni de la data constatarii lipsei de conformitate.
          </Text>
          <Text style={st.p2Text}>
            In cazul in care se solicita inlocuirea unei piese in termen de garantie, reclamantul va prezenta urmatoarele documente:
          </Text>
          <Text style={st.p2Bullet}>- deviz de montaj intr-un service autorizat</Text>
          <Text style={st.p2Bullet}>- nota de constatare</Text>
          <Text style={st.p2Bullet}>- copie talon autovehiculului</Text>
          <Text style={st.p2Text}>{"\n"}In termen de 15 zile calendaristice de la data la care cumparatorul constata lipsa de conformitate vanzatorul va solutiona cererea.</Text>
        </View>

        <View style={st.p2Section}>
          <Text style={st.p2Text}>Nu se acorda garantie sau se anuleaza garantia in urmatoarele cazuri:</Text>
          <Text style={st.p2Bullet}>- piesele nu au fost montate intr-un atelier de specialitate autorizat</Text>
          <Text style={st.p2Bullet}>- piesele prezinta urme de lovituri, zgarieturi, indoituri sau actiunea unor factori externi</Text>
          <Text style={st.p2Bullet}>- piesele prezinta o uzura normala</Text>
          <Text style={st.p2Bullet}>- piesele se defecteaza din cauza unui montaj necorespunzator</Text>
          <Text style={st.p2Bullet}>- defectiunea este cauzata de o proasta intretinere a autovehiculului, neverificarea la timp sau periodic, conform indicatiilor atelierului de specialitate ce a montat piesa</Text>
          <Text style={st.p2Bullet}>- piesa s-a defectat datorita montajului acesteia in ansamblu cu alte piese defecte sau modificate ale autovehiculului</Text>
          <Text style={st.p2Bullet}>- piesa nu a fost identificata corect, datorita datelor eronate prezentate de cumparator si nici nu a fost comparata cu piesa ce a trebuit inlocuita</Text>
          <Text style={st.p2Bullet}>- piesa prezinta deficiente din cauza unui accident de circulatie sau de alta natura -socuri termice, socuri electrice, socuri mecanice etc.-</Text>
          <Text style={st.p2Bullet}>- uzura normala a pieselor ce intra in fluxul normal de intretinere al autovehiculului</Text>
          <Text style={st.p2Bullet}>- piesele de uzura a caror longevitate depinde de timpul de utilizare al vehiculului.</Text>
        </View>

        <Text style={st.p2SubTitle}>PROTECTIA DATELOR CU CARACTER PERSONAL</Text>
        <Text style={st.p2Text}>
          Informarea privind protectia datelor cu caracter personal este disponibila la: www.autotruck.ro/infocenter/gdpr
        </Text>

        <Text style={st.p2LocationTitle}>SC AUTO-TRUCK SRL - PUNCTE DE LUCRU</Text>
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: "30%" }}>
            <Text style={st.p2LocationBold}>TIMISOARA SEDIU,</Text>
            <Text style={st.p2LocationBold}>TIMISOARA DEPOZIT,</Text>
            <Text style={st.p2LocationBold}>BAIA MARE DEPOZIT,</Text>
          </View>
          <View style={{ width: "70%" }}>
            <Text style={st.p2Location}>Str. MIRESEI, nr. 12A, CP 300642, jud. Timis, 0256/244136, timisoara@autotruck.ro;</Text>
            <Text style={st.p2Location}>Str. CLOSCA, nr. 47, CP 300350, jud. Timis, 0799/554758, timisoara@autotruck.ro;</Text>
            <Text style={st.p2Location}>Bd. UNIRII, nr. 19, CP 430232, jud. Maramures, 0751/155013, baiamare@autotruck.ro;</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
