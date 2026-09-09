import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Application-level encryption for PII (Personally Identifiable Information).
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive personal data
 * before storing in the database.
 *
 * Set PII_ENCRYPTION_KEY in your environment (min 32 chars).
 * If not set, falls back to no-op (returns plaintext) with a warning.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended
const AUTH_TAG_LENGTH = 16;
const ENCODING = "base64" as const;
const PREFIX = "enc:"; // marks encrypted values

function getKey(): Buffer | null {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[PII] WARNING: PII_ENCRYPTION_KEY not set — personal data stored unencrypted!");
    }
    return null;
  }
  // Derive a 32-byte key from the secret
  return scryptSync(raw, "shoptruck-pii-salt", 32);
}

/**
 * Encrypt a PII value before storing in the database.
 * Returns the original value if encryption key is not configured.
 */
export function encryptPII(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;

  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: PREFIX + base64(iv + authTag + ciphertext)
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return PREFIX + combined.toString(ENCODING);
}

/**
 * Decrypt a PII value read from the database.
 * Handles both encrypted (prefixed) and legacy plaintext values.
 */
export function decryptPII(stored: string | null | undefined): string | null {
  if (!stored) return null;

  // Not encrypted — return as-is (legacy data or no key configured)
  if (!stored.startsWith(PREFIX)) return stored;

  const key = getKey();
  if (!key) {
    // Key not available but data is encrypted — can't decrypt
    return "[date criptate]";
  }

  try {
    const combined = Buffer.from(stored.slice(PREFIX.length), ENCODING);
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return "[eroare decriptare]";
  }
}

/**
 * Mask a PII value for logging — never log personal data in full.
 * "john@example.com" → "jo***om"
 * "0721234567" → "07***67"
 */
export function maskPII(value: string | null | undefined): string {
  if (!value) return "***";
  if (value.length <= 4) return "***";
  return value.slice(0, 2) + "***" + value.slice(-2);
}
