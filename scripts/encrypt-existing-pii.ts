/**
 * One-time migration: encrypt existing plaintext PII in account and partner tables.
 *
 * Usage: npx tsx scripts/encrypt-existing-pii.ts
 *
 * Safe to run multiple times — skips already-encrypted values (prefixed with "enc:").
 */

import "dotenv/config";
import postgres from "postgres";
import { createCipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:";

const raw = process.env.PII_ENCRYPTION_KEY;
if (!raw || raw.length < 16) {
  console.error("❌ PII_ENCRYPTION_KEY not set or too short. Set it in .env first.");
  process.exit(1);
}

const key = scryptSync(raw, "shoptruck-pii-salt", 32);

function encrypt(plaintext: string | null): string | null {
  if (!plaintext) return null;
  if (plaintext.startsWith(PREFIX)) return plaintext; // already encrypted

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return PREFIX + combined.toString("base64");
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(dbUrl.trim(), { ssl: "require", prepare: false, max: 3 });

const PII_FIELDS_ACCOUNT = ["phone", "tax_id", "reg_no", "billing_line1"];
const PII_FIELDS_PARTNER = ["phone", "tax_id", "reg_no"];

async function migrateTable(table: string, fields: string[]) {
  console.log(`\n📋 Processing ${table}...`);

  const rows = await sql.unsafe(`SELECT id, ${fields.join(", ")} FROM ${table}`);
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const updates: Record<string, string | null> = {};
    let needsUpdate = false;

    for (const field of fields) {
      const value = row[field];
      if (value && typeof value === "string" && !value.startsWith(PREFIX)) {
        updates[field] = encrypt(value);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const setClauses = Object.entries(updates)
        .map(([k], i) => `${k} = $${i + 2}`)
        .join(", ");
      const values = [row.id, ...Object.values(updates)];

      await sql.unsafe(
        `UPDATE ${table} SET ${setClauses}, updated_at = now() WHERE id = $1`,
        values
      );
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`  ✅ ${updated} rows encrypted, ${skipped} already encrypted/empty`);
}

async function migrateOrderNotes() {
  console.log(`\n📋 Processing order notes...`);

  const rows = await sql.unsafe(
    `SELECT id, notes FROM public."order" WHERE notes IS NOT NULL AND notes != '' AND notes NOT LIKE 'enc:%'`
  );
  let updated = 0;

  for (const row of rows) {
    const encrypted = encrypt(row.notes);
    await sql.unsafe(
      `UPDATE public."order" SET notes = $2, updated_at = now() WHERE id = $1`,
      [row.id, encrypted]
    );
    updated++;
  }

  console.log(`  ✅ ${updated} order notes encrypted`);
}

async function main() {
  console.log("🔐 Encrypting existing PII data...\n");

  try {
    await migrateTable("account", PII_FIELDS_ACCOUNT);
    await migrateTable("partner", PII_FIELDS_PARTNER);
    await migrateOrderNotes();

    console.log("\n✅ Done! All existing PII is now encrypted.");
  } catch (err) {
    console.error("\n❌ Error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
