import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// - Styles -
const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1e293b",
    backgroundColor: "#fff",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#feab1f",
  },
  titleBlock: { flexDirection: "column" },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    letterSpacing: 1,
  },
  subTitle: { fontSize: 9, color: "#64748b", marginTop: 3 },
  dateBlock: { alignItems: "flex-end" },
  dateText: { fontSize: 9, color: "#475569" },
  validText: {
    fontSize: 9,
    color: "#dc2626",
    marginTop: 3,
    fontFamily: "Helvetica-Bold",
  },

  // Info boxes
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  infoBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
  },
  infoText: { fontSize: 9, color: "#1e293b", marginBottom: 2 },
  infoMuted: { fontSize: 8, color: "#64748b", marginBottom: 2 },

  // Table
  table: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
    minHeight: 44,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },

  // Columns
  colImg: { width: "8%", alignItems: "center", justifyContent: "center" },
  colDesc: { width: "30%", paddingRight: 4 },
  colQty: { width: "7%", textAlign: "center" },
  colPrice: { width: "12%", textAlign: "right" },
  colNet: { width: "13%", textAlign: "right" },
  colTaxRate: { width: "8%", textAlign: "center" },
  colTaxVal: { width: "11%", textAlign: "right" },
  colTotal: { width: "11%", textAlign: "right" },

  productImg: {
    width: 32,
    height: 32,
    borderRadius: 3,
    objectFit: "contain",
    backgroundColor: "#f1f5f9",
  },
  imgPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 3,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  productName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  productSku: { fontSize: 7, color: "#94a3b8", marginTop: 1 },

  // Summary
  summarySection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  summaryBox: {
    width: "38%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  summaryLabel: { fontSize: 9, color: "#475569" },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1e293b" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
  },
  totalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#fff" },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#feab1f" },

  // Notes
  notesBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  notesText: { fontSize: 9, color: "#475569" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: "#94a3b8" },
});

// - Helpers -
function fmt2(n: number) {
  return n.toFixed(2).replace(".", ",");
}

// - Sanitize text for PDF (Helvetica has no diacritics) -
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

// - PDF Document -
export default function OfferPDFDocument({ offer }: { offer: any }) {
  if (!offer) {
    return (
      <Document>
        <Page style={styles.page}>
          <Text>No Data</Text>
        </Page>
      </Document>
    );
  }

  const items = offer.items || [];

  let totalNet = 0;
  let totalTVA = 0;

  const processedItems = items.map((item: any) => {
    const qty = Number(item.quantity ?? item.qty) || 1;
    const price = Number(item.price ?? item.unit_price_net) || 0;
    const taxPct = Number(item.tax ?? item.tax_percent) || 0;
    const lineNet = qty * price;
    const lineTVA = lineNet * (taxPct / 100);
    const lineTotal = lineNet + lineTVA;
    totalNet += lineNet;
    totalTVA += lineTVA;
    return { ...item, qty, price, taxPct, lineNet, lineTVA, lineTotal };
  });

  const totalGeneral = totalNet + totalTVA;

  const veh = offer.vehicle;
  const vehicleLabel = veh
    ? [veh.make || veh.brand, veh.model].filter(Boolean).join(" ") || null
    : null;

  const docNo = String(offer.id ?? "")
    .slice(0, 8)
    .toUpperCase();
  const today = new Date().toLocaleDateString("ro-RO");
  const validUntil = offer.validUntil
    ? new Date(offer.validUntil).toLocaleDateString("ro-RO")
    : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>OFERTA DE PRET</Text>
            <Text style={styles.subTitle}>Nr. {docNo}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateText}>Data: {today}</Text>
            {validUntil && (
              <Text style={styles.validText}>Valabil pana: {validUntil}</Text>
            )}
          </View>
        </View>

        {/* CLIENT + VEHICLE */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Beneficiar</Text>
            <Text style={styles.infoText}>
              {s(offer.customer?.display_name || offer.clientName || "-")}
            </Text>
            {offer.customer?.vat_id && (
              <Text style={styles.infoMuted}>CUI: {offer.customer.vat_id}</Text>
            )}
            {offer.customer?.reg_no && (
              <Text style={styles.infoMuted}>Reg: {offer.customer.reg_no}</Text>
            )}
            {offer.customer?.phone && (
              <Text style={styles.infoMuted}>Tel: {offer.customer.phone}</Text>
            )}
            {offer.customer?.email && (
              <Text style={styles.infoMuted}>{offer.customer.email}</Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Vehicul</Text>
            {vehicleLabel && (
              <Text style={styles.infoText}>{s(vehicleLabel)}</Text>
            )}
            {(veh?.plate_no || veh?.plate_number) && (
              <Text style={styles.infoMuted}>
                Nr.: {s(veh?.plate_no || veh?.plate_number)}
              </Text>
            )}
            {(veh?.chassis_vin || veh?.vin) && (
              <Text style={styles.infoMuted}>
                VIN: {s(veh?.chassis_vin || veh?.vin)}
              </Text>
            )}
            {veh?.engine_code && (
              <Text style={styles.infoMuted}>Motor: {veh.engine_code}</Text>
            )}
            {veh?.year && <Text style={styles.infoMuted}>An: {veh.year}</Text>}
          </View>
        </View>

        {/* TABLE */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeader}>
            <View style={styles.colImg}>
              <Text style={styles.tableHeaderText}></Text>
            </View>
            <View style={styles.colDesc}>
              <Text style={styles.tableHeaderText}>Produs</Text>
            </View>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Cant.</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>
              Pret unit
            </Text>
            <Text style={[styles.tableHeaderText, styles.colNet]}>
              Val. neta
            </Text>
            <Text style={[styles.tableHeaderText, styles.colTaxRate]}>
              TVA%
            </Text>
            <Text style={[styles.tableHeaderText, styles.colTaxVal]}>TVA</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
          </View>

          {/* Data rows */}
          {processedItems.map((item: any, idx: number) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              {/* Product image */}
              <View style={styles.colImg}>
                {item.image_url ? (
                  <Image src={item.image_url} style={styles.productImg} />
                ) : (
                  <View style={styles.imgPlaceholder} />
                )}
              </View>

              {/* Description */}
              <View style={styles.colDesc}>
                <Text style={styles.productName}>{s(item.name)}</Text>
                {item.sku && (
                  <Text style={styles.productSku}>SKU: {item.sku}</Text>
                )}
              </View>

              <Text style={[{ fontSize: 9, color: "#1e293b" }, styles.colQty]}>
                {item.qty}
              </Text>
              <Text
                style={[{ fontSize: 9, color: "#1e293b" }, styles.colPrice]}
              >
                {fmt2(item.price)}
              </Text>
              <Text style={[{ fontSize: 9, color: "#1e293b" }, styles.colNet]}>
                {fmt2(item.lineNet)}
              </Text>
              <Text
                style={[{ fontSize: 9, color: "#64748b" }, styles.colTaxRate]}
              >
                {item.taxPct}%
              </Text>
              <Text
                style={[{ fontSize: 9, color: "#64748b" }, styles.colTaxVal]}
              >
                {fmt2(item.lineTVA)}
              </Text>
              <Text
                style={[
                  {
                    fontSize: 9,
                    fontFamily: "Helvetica-Bold",
                    color: "#0f172a",
                  },
                  styles.colTotal,
                ]}
              >
                {fmt2(item.lineTotal)}
              </Text>
            </View>
          ))}
        </View>

        {/* SUMMARY */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total net (fara TVA):</Text>
              <Text style={styles.summaryValue}>{fmt2(totalNet)} RON</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total TVA:</Text>
              <Text style={styles.summaryValue}>{fmt2(totalTVA)} RON</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL GENERAL:</Text>
              <Text style={styles.totalValue}>{fmt2(totalGeneral)} RON</Text>
            </View>
          </View>
        </View>

        {/* NOTES */}
        {offer.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Observatii</Text>
            <Text style={styles.notesText}>{s(offer.notes)}</Text>
          </View>
        ) : null}

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Oferta Nr. {docNo} - {today}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Pagina ${pageNumber} din ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
