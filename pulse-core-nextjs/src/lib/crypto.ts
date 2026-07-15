/**
 * Military Grade Encryption Utility
 * uses AES-GCM (256-bit) via Web Crypto API
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

function getWebCrypto(): Crypto {
    if (!globalThis.crypto) {
        throw new Error('Web Crypto API is not available in this runtime.');
    }
    return globalThis.crypto;
}

export async function generateKey(): Promise<CryptoKey> {
    const webCrypto = getWebCrypto();
    return webCrypto.subtle.generateKey(
        {
            name: ALGORITHM,
            length: KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptData(data: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
    const webCrypto = getWebCrypto();
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const iv = webCrypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await webCrypto.subtle.encrypt(
        {
            name: ALGORITHM,
            iv: iv as any,
        },
        key,
        encodedData as any
    );

    return { ciphertext, iv };
}

export async function decryptData(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
    const webCrypto = getWebCrypto();
    const decryptedContent = await webCrypto.subtle.decrypt(
        {
            name: ALGORITHM,
            iv: iv as any,
        },
        key,
        ciphertext as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedContent);
}

// Helper to convert Buffer to Base64 for storage
export function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
