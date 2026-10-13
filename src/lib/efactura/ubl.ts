import "server-only";
import { getSeller } from "./config";

/**
 * Builds a RO_CIUS-flavoured UBL 2.1 Invoice XML from an invoice + its lines.
 *
 * This is a best-effort mapping covering the common case (standard invoice, RON, single VAT
 * rate). CIUS-RO has more field-level rules than are encoded here (e.g. exemption reasons,
 * reverse charge, partial payments). Before relying on this in production, submit generated
 * XML to ANAF's `/validare` test endpoint and adjust based on the Schematron errors it returns.
 */

export type UblCustomer = {
  isCompany: boolean;
  displayName: string;
  legalName?: string | null;
  cif?: string | null; // decrypted, digits only (no "RO" prefix)
  isVatPayer?: boolean;
  regCom?: string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null; // ISO 3166-1 alpha-2, default RO
};

export type UblInvoiceLine = {
  name: string;
  code?: string | null;
  uom?: string | null;
  quantity: number;
  unitPriceNet: number;
  lineNet: number;
  taxRatePct: number;
};

export type UblInvoice = {
  id: string; // series + number
  issueDate: string; // YYYY-MM-DD
  dueDate?: string | null; // YYYY-MM-DD
  taxRatePct: number;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  notes?: string | null;
  customer: UblCustomer;
  lines: UblInvoiceLine[];
};

const UOM_CODES: Record<string, string> = {
  buc: "H87",
  bucata: "H87",
  kg: "KGM",
  kgm: "KGM",
  l: "LTR",
  ltr: "LTR",
  m: "MTR",
  mtr: "MTR",
  set: "SET",
  cutie: "XBX",
};

function unitCode(uom?: string | null) {
  const key = (uom || "").trim().toLowerCase();
  return UOM_CODES[key] || "H87";
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

function taxCategoryId(ratePct: number): "S" | "Z" {
  return ratePct > 0 ? "S" : "Z";
}

function partyBlock(opts: {
  name: string;
  legalName?: string | null;
  cif?: string | null;
  vatId?: string | null; // with country prefix, only when VAT payer
  regCom?: string | null;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null;
}) {
  const country = (opts.country || "RO").toUpperCase();
  const addressBlock = `
      <cac:PostalAddress>
        <cbc:StreetName>${esc(opts.address || "-")}</cbc:StreetName>
        <cbc:CityName>${esc(opts.city || "-")}</cbc:CityName>
        ${opts.county ? `<cbc:CountrySubentity>${esc(opts.county)}</cbc:CountrySubentity>` : ""}
        <cac:Country><cbc:IdentificationCode>${esc(country)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>`;

  const taxScheme = opts.vatId
    ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(opts.vatId)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : "";

  const legalEntity = opts.cif
    ? `
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(opts.legalName || opts.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${esc(opts.cif)}</cbc:CompanyID>
        ${opts.regCom ? `<cbc:CompanyLegalForm>${esc(opts.regCom)}</cbc:CompanyLegalForm>` : ""}
      </cac:PartyLegalEntity>`
    : "";

  return `
    <cac:Party>
      <cac:PartyName><cbc:Name>${esc(opts.name)}</cbc:Name></cac:PartyName>${addressBlock}${taxScheme}${legalEntity}
    </cac:Party>`;
}

export function buildInvoiceXml(inv: UblInvoice): string {
  const seller = getSeller();

  const supplier = partyBlock({
    name: seller.legalName,
    legalName: seller.legalName,
    cif: seller.cif,
    vatId: seller.isVatPayer ? seller.vatNumber || `RO${seller.cif}` : null,
    regCom: seller.regCom,
    address: seller.address,
    city: seller.city,
    county: seller.county,
    country: seller.country,
  });

  const c = inv.customer;
  const customer = partyBlock({
    name: c.displayName,
    legalName: c.legalName,
    cif: c.isCompany ? c.cif || null : null,
    vatId: c.isCompany && c.isVatPayer && c.cif ? `RO${c.cif}` : null,
    regCom: c.regCom,
    address: c.address,
    city: c.city,
    county: c.county,
    country: c.country,
  });

  const taxCat = taxCategoryId(inv.taxRatePct);

  const lines = inv.lines
    .map((line, i) => {
      const lineTaxCat = taxCategoryId(line.taxRatePct);
      return `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${unitCode(line.uom)}">${line.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="RON">${money(line.lineNet)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${esc(line.name)}</cbc:Name>
        ${line.code ? `<cac:SellersItemIdentification><cbc:ID>${esc(line.code)}</cbc:ID></cac:SellersItemIdentification>` : ""}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${lineTaxCat}</cbc:ID>
          <cbc:Percent>${line.taxRatePct}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="RON">${money(line.unitPriceNet)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>${esc(inv.id)}</cbc:ID>
  <cbc:IssueDate>${esc(inv.issueDate)}</cbc:IssueDate>
  ${inv.dueDate ? `<cbc:DueDate>${esc(inv.dueDate)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${inv.notes ? `<cbc:Note>${esc(inv.notes)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>${supplier}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${customer}
  </cac:AccountingCustomerParty>
  ${seller.iban
    ? `<cac:PaymentMeans>
    <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount><cbc:ID>${esc(seller.iban)}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : ""}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">${money(inv.totalTax)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="RON">${money(inv.totalNet)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="RON">${money(inv.totalTax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${taxCat}</cbc:ID>
        <cbc:Percent>${inv.taxRatePct}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RON">${money(inv.totalNet)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RON">${money(inv.totalNet)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">${money(inv.totalGross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">${money(inv.totalGross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
}
