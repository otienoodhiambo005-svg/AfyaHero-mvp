import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) return null;
  return createHash('sha256').update(raw).digest();
}

export function encryptAtRest(plainText: string): string {
  const key = getEncryptionKey();
  if (!key) return plainText;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join(':');
}

export function decryptAtRest(payload: string): string {
  if (!payload.startsWith(`${PREFIX}:`)) return payload;
  const key = getEncryptionKey();
  if (!key) return payload;

  const parts = payload.split(':');
  if (parts.length !== 5) return payload;

  try {
    const iv = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    const tag = Buffer.from(parts[4], 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return payload;
  }
}

