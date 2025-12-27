import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

// --- STILURI ---
const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica", color: "#333" },

  // Header Generic
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "bold" },
  subTitle: { fontSize: 10, color: "#666", marginTop: 5 },

  // Info Client/Vehicul
  rowInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBox: { width: "45%" },
  sectionTitle: {
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 4,
    paddingBottom: 2,
    fontSize: 10,
  },
  infoText: { marginBottom: 2 },

  // TABEL - Configurare
  table: { marginTop: 10, borderWidth: 1, borderColor: "#eee" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontWeight: "bold",
    fontSize: 8, // Font puțin mai mic la header pentru a încăpea tot
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    fontSize: 9,
  },

  // COLOANE TABEL (Total = 100%)
  // Am ajustat lățimile pentru a face loc la TVA și Total Brut
  colDesc: { width: "30%" },
  colQty: { width: "8%", textAlign: "center" },
  colPrice: { width: "13%", textAlign: "right" }, // Preț Unit
  colNet: { width: "15%", textAlign: "right" }, // Val. Netă (Cant x Preț)
  colTaxRate: { width: "9%", textAlign: "center" }, // % TVA
  colTaxVal: { width: "12%", textAlign: "right" }, // Val. TVA (RON)
  colTotal: { width: "13%", textAlign: "right" }, // Total Rând (Net + TVA)

  // Totaluri Finale
  summarySection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },
  summaryBox: { width: "40%" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingBottom: 2,
  },
  summaryLabel: { fontSize: 10 },
  summaryValue: { fontSize: 10, fontWeight: "bold", textAlign: "right" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#000",
  },
  totalLarge: { fontSize: 12, fontWeight: "bold" },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#aaa",
  },
});

export default function OfferPDFDocument({ offer }: { offer: any }) {
  if (!offer)
    return (
      <Document>
        <Page>
          <Text>No Data</Text>
        </Page>
      </Document>
    );

  const items = offer.items || [];

  // Variabile pentru Totaluri Generale
  let totalNetGlobal = 0;
  let totalTVAGlobal = 0;

  // Procesăm itemele pentru a avea calculele gata de afișare
  const processedItems = items.map((item: any) => {
    const qty = Number(item.quantity || item.qty) || 1;
    const price = Number(item.price) || 0; // Preț Unitar
    const taxPercent = Number(item.tax) || 0; // Cota TVA (ex: 19)

    // Calcule per rând
    const lineNet = qty * price; // Valoare Netă
    const lineTVA = lineNet * (taxPercent / 100); // Valoare TVA
    const lineTotal = lineNet + lineTVA; // Total Brut (Net + TVA)

    // Adăugăm la totalurile globale
    totalNetGlobal += lineNet;
    totalTVAGlobal += lineTVA;

    return {
      ...item,
      qty,
      price,
      taxPercent,
      lineNet,
      lineTVA,
      lineTotal,
    };
  });

  const totalGeneral = totalNetGlobal + totalTVAGlobal;

  // Helper formatare vehicul
  const formatVehicle = () => {
    if (!offer.vehicle) return "-";
    const { brand, model, plate_number, vin } = offer.vehicle;
    let text = `${brand || ""} ${model || ""}`.trim();
    if (plate_number) text += ` (${plate_number})`;
    if (!text && vin) text = `VIN: ${vin}`;
    return text || "-";
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>OFERTA DE PRET</Text>
            <Text style={styles.subTitle}>
              Nr. {offer.id?.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text>Data: {new Date().toLocaleDateString("ro-RO")}</Text>
            {offer.validUntil && (
              <Text style={{ fontSize: 9, color: "red", marginTop: 2 }}>
                Valabil:{" "}
                {new Date(offer.validUntil).toLocaleDateString("ro-RO")}
              </Text>
            )}
          </View>
        </View>

        {/* INFO */}
        <View style={styles.rowInfo}>
          <View style={styles.infoBox}>
            <Text style={styles.sectionTitle}>Beneficiar</Text>
            <Text style={styles.infoText}>
              {offer.customer?.display_name || offer.clientName || "-"}
            </Text>
            {offer.customer?.vat_id && (
              <Text style={styles.infoText}>CUI: {offer.customer.vat_id}</Text>
            )}
            {offer.customer?.phone && (
              <Text style={styles.infoText}>Tel: {offer.customer.phone}</Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.sectionTitle}>Vehicul</Text>
            <Text style={styles.infoText}>{formatVehicle()}</Text>
            {offer.vehicle?.vin && (
              <Text style={styles.infoText}>VIN: {offer.vehicle.vin}</Text>
            )}
          </View>
        </View>

        {/* TABEL COMPLET */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Descriere</Text>
            <Text style={styles.colQty}>Cant.</Text>
            <Text style={styles.colPrice}>Preț Unit.</Text>
            <Text style={styles.colNet}>Val. Netă</Text>
            <Text style={styles.colTaxRate}>TVA %</Text>
            <Text style={styles.colTaxVal}>Val. TVA</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>

          {processedItems.map((item: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.name}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colPrice}>{item.price.toFixed(2)}</Text>

              {/* Valoare Netă */}
              <Text style={styles.colNet}>{item.lineNet.toFixed(2)}</Text>

              {/* Cota TVA */}
              <Text style={styles.colTaxRate}>{item.taxPercent}%</Text>

              {/* Valoare TVA (Calculată pe rând) */}
              <Text style={styles.colTaxVal}>{item.lineTVA.toFixed(2)}</Text>

              {/* Total Rând (Net + TVA) */}
              <Text style={styles.colTotal}>{item.lineTotal.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* TOTALURI FINALE */}
        <View style={styles.summarySection}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Net:</Text>
              <Text style={styles.summaryValue}>
                {totalNetGlobal.toFixed(2)} RON
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total TVA:</Text>
              <Text style={styles.summaryValue}>
                {totalTVAGlobal.toFixed(2)} RON
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLarge}>TOTAL GENERAL:</Text>
              <Text style={styles.totalLarge}>
                {totalGeneral.toFixed(2)} RON
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>Document generat automat.</Text>
      </Page>
    </Document>
  );
}
