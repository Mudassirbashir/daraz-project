import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SECRET = process.env.DARAZ_ENCRYPTION_SECRET || process.env.DARAZ_APP_SECRET || 'default_daraz_master_encryption_key_32_bytes!';

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(DEFAULT_SECRET).digest();
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptSecret(plainText: string | null | undefined): string | null {
  if (!plainText || !plainText.trim()) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const result: EncryptedData = {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag,
    };

    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (err) {
    console.error('[Encryption] Failed to encrypt secret:', err);
    return null;
  }
}

export function decryptSecret(encryptedBase64: string | null | undefined): string | null {
  if (!encryptedBase64 || !encryptedBase64.trim()) return null;

  try {
    const key = getEncryptionKey();
    const rawJson = Buffer.from(encryptedBase64, 'base64').toString('utf8');

    let parsed: EncryptedData;
    try {
      parsed = JSON.parse(rawJson);
    } catch (_) {
      // Return plainText if already unencrypted legacy data
      return encryptedBase64;
    }

    if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
      return encryptedBase64;
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(parsed.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));

    let decrypted = decipher.update(parsed.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Return original string if fallback is plain text
    return encryptedBase64;
  }
}

export function maskSecret(secret: string | null | undefined): string {
  if (!secret || secret.length <= 4) return '****';
  return `${secret.slice(0, 3)}****${secret.slice(-3)}`;
}
