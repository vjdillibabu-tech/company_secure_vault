const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommended IV length for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Derive a consistent 32-byte key from a dedicated ENCRYPTION_KEY env var.
 * Falls back to deriving from JWT_SECRET for backward compatibility.
 */
function getKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "fallback-secret-key";
  return crypto.scryptSync(secret, "vault-salt", 32);
}

/**
 * Encrypt a plaintext string with AES-256-GCM (authenticated encryption).
 * Returns a string in the format: iv:authTag:encryptedData (all hex-encoded).
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Accepts both the new GCM format (iv:authTag:data) and legacy CBC format (iv:data)
 * for backward compatibility with existing encrypted passwords.
 */
function decrypt(ciphertext) {
  const key = getKey();
  const parts = ciphertext.split(":");

  if (parts.length === 3) {
    // New GCM format: iv:authTag:encryptedData
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } else if (parts.length === 2) {
    // Legacy CBC format: iv:encryptedData (backward compat)
    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  throw new Error("Unrecognized ciphertext format");
}

module.exports = { encrypt, decrypt };
