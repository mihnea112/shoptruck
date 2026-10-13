import "server-only";

/**
 * Fixed identity of the issuing company (the seller on every invoice sent to e-Factura).
 * Set these once in the environment — they don't vary per invoice.
 */
export function getSeller() {
  return {
    cif: (process.env.ANAF_SELLER_CIF || "").trim(), // numeric CIF, no "RO" prefix
    vatNumber: (process.env.ANAF_SELLER_VAT_NUMBER || "").trim(), // "RO" + CIF if VAT payer, else same as cif
    legalName: (process.env.ANAF_SELLER_LEGAL_NAME || "").trim(),
    regCom: (process.env.ANAF_SELLER_REG_COM || "").trim(), // e.g. J40/1234/2020
    address: (process.env.ANAF_SELLER_ADDRESS || "").trim(),
    city: (process.env.ANAF_SELLER_CITY || "").trim(),
    county: (process.env.ANAF_SELLER_COUNTY || "").trim(), // ISO 3166-2:RO subdivision code, e.g. RO-B
    country: (process.env.ANAF_SELLER_COUNTRY || "RO").trim(),
    isVatPayer: process.env.ANAF_SELLER_IS_VAT_PAYER !== "false",
    iban: (process.env.ANAF_SELLER_IBAN || "").trim(),
    bankName: (process.env.ANAF_SELLER_BANK_NAME || "").trim(),
  };
}

export function isEfacturaEnv() {
  return process.env.ANAF_EFACTURA_ENV === "prod" ? "prod" : "test";
}

export function getOAuthConfig() {
  return {
    clientId: (process.env.ANAF_CLIENT_ID || "").trim(),
    clientSecret: (process.env.ANAF_CLIENT_SECRET || "").trim(),
    redirectUri: (process.env.ANAF_REDIRECT_URI || "").trim(),
  };
}
