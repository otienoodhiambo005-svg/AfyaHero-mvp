import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

// Encoded format: scrypt$<saltHex>$<hashHex>
export async function hashPassword(password: string): Promise<string> {
  const saltText = randomBytes(16).toString('base64url');
  const saltHex = Buffer.from(saltText, 'utf8').toString('hex');
  const hash = await scryptAsync(password, saltText, 64);
  return `scrypt$${saltHex}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  try {
    const derived = await scryptAsync(password, Buffer.from(saltHex, 'hex').toString('utf8'), 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
