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

export type ChitantaData = {
  series: string;
  number: number;
  chitantaDate: string;
  amount: number;
  amountWords: string;
  representing: string;
  customer: {
    display_name: string;
    reg_no?: string;
    vat_id?: string;
    address?: string;
    city?: string;
    county?: string;
  };
};

const st = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  // Top company block
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  companyLine: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  // Title row
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 20,
    marginBottom: 16,
    borderTop: "1pt solid #333",
    borderBottom: "1pt solid #333",
    paddingVertical: 10,
  },
  titleText: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  seriesBlock: {
    textAlign: "right",
    fontSize: 10,
  },
  dateBlock: {
    textAlign: "left",
    fontSize: 10,
  },
  // Received from section
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  label: {
    fontSize: 9,
    width: 120,
    color: "#444",
  },
  value: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  // Amount
  amountBox: {
    marginTop: 20,
    borderTop: "1pt solid #333",
    borderBottom: "1pt solid #333",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 11,
    width: 80,
  },
  amountValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  amountWords: {
    fontSize: 9,
    marginTop: 2,
    color: "#444",
  },
  representing: {
    fontSize: 10,
    marginTop: 6,
  },
  // Stamp area
  stampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 50,
  },
  stampBox: {
    width: "40%",
    alignItems: "center",
  },
  stampLabel: {
    fontSize: 9,
    color: "#444",
    marginBottom: 30,
  },
  stampLine: {
    width: "100%",
    borderBottom: "0.5pt solid #999",
  },
});

export default function ChitantaPdfDocument({ data }: { data: ChitantaData }) {
  const c = data.customer;

  return (
    <Document>
      <Page size="A4" style={st.page}>
        {/* Company header */}
        <Text style={st.companyName}>{s("SC AUTO-TRUCK S.R.L.")}</Text>
        <Text style={st.companyLine}>{s("Nr.ord.Reg.Com./an: J35/838/2001")}</Text>
        <Text style={st.companyLine}>{s("C.U.I.: RO14084923")}</Text>
        <Text style={st.companyLine}>{s("Sediu: Str.MIRESEI Nr.12A, Timișoara")}</Text>
        <Text style={st.companyLine}>{s("Județul: Timiș")}</Text>
        <Text style={st.companyLine}>{s("Banca: ING Timișoara")}</Text>
        <Text style={st.companyLine}>{s("Cont: RO54INGB0002008182298911")}</Text>
        <Text style={st.companyLine}>{s("Tel/Fax: 0256/244136")}</Text>
        <Text style={st.companyLine}>{s("Capital social: 50.000 LEI")}</Text>

        {/* Title row */}
        <View style={st.titleRow}>
          <View style={st.dateBlock}>
            <Text>{s(`Data: ${data.chitantaDate}`)}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={st.titleText}>{s("CHITANTA")}</Text>
          </View>
          <View style={st.seriesBlock}>
            <Text>{s(`Seria ${data.series}`)}</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
              {s(`Nr. ${data.number}`)}
            </Text>
          </View>
        </View>

        {/* Received from */}
        <View style={st.section}>
          <Text style={st.sectionLabel}>{s("Am primit de la:")}</Text>
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
              {s(c.display_name)}
            </Text>
            {c.reg_no && (
              <View style={st.row}>
                <Text style={st.label}>{s("Nr.ord.Reg.Com./an:")}</Text>
                <Text style={st.value}>{s(c.reg_no)}</Text>
              </View>
            )}
            {c.vat_id && (
              <View style={st.row}>
                <Text style={st.label}>{s("C.U.I.:")}</Text>
                <Text style={st.value}>{s(c.vat_id)}</Text>
              </View>
            )}
            {c.address && (
              <View style={st.row}>
                <Text style={st.label}>{s("Adresa:")}</Text>
                <Text style={st.value}>{s(c.address)}</Text>
              </View>
            )}
            {c.county && (
              <View style={st.row}>
                <Text style={st.label}>{s("Județul:")}</Text>
                <Text style={st.value}>{s(c.county)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Amount box */}
        <View style={st.amountBox}>
          <View style={st.amountRow}>
            <Text style={st.amountLabel}>{s("Suma de:")}</Text>
            <Text style={st.amountValue}>{s(`${fmt(data.amount)} LEI`)}</Text>
          </View>
          <Text style={st.amountWords}>
            {s(`adica: ${data.amountWords}`)}
          </Text>
          <Text style={st.representing}>
            {s(`Reprezentand: ${data.representing}`)}
          </Text>
        </View>

        {/* Signature / stamp area */}
        <View style={st.stampRow}>
          <View style={st.stampBox}>
            <Text style={st.stampLabel}>{s("Semnătura")}</Text>
            <View style={st.stampLine} />
          </View>
          <View style={st.stampBox}>
            <Text style={st.stampLabel}>{s("Ștampila")}</Text>
            <View style={st.stampLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
