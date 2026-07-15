from cryptography.fernet import Fernet, InvalidToken
import base64
import json
from typing import Any

from app.config import get_settings

settings = get_settings()


class PIIEncryption:
    """Field-level encryption for sensitive patient PII data"""

    def __init__(self):
        if not settings.PII_ENCRYPTION_KEY:
            raise RuntimeError("PII_ENCRYPTION_KEY not configured")

        # Ensure key is properly formatted for Fernet
        key_bytes = settings.PII_ENCRYPTION_KEY.encode()
        if len(key_bytes) != 32:
            raise ValueError("PII_ENCRYPTION_KEY must be exactly 32 bytes")

        fernet_key = base64.urlsafe_b64encode(key_bytes)
        self.fernet = Fernet(fernet_key)

    def encrypt(self, plaintext: str | bytes) -> bytes:
        """Encrypt plaintext string or bytes"""
        if isinstance(plaintext, str):
            plaintext = plaintext.encode("utf-8")
        return self.fernet.encrypt(plaintext)

    def decrypt(self, ciphertext: bytes) -> str:
        """Decrypt ciphertext to string"""
        try:
            return self.fernet.decrypt(ciphertext).decode("utf-8")
        except InvalidToken:
            raise ValueError("Invalid or corrupted encrypted data")

    def encrypt_json(self, data: Any) -> bytes:
        """Encrypt arbitrary JSON-serializable data"""
        json_str = json.dumps(data)
        return self.encrypt(json_str)

    def decrypt_json(self, ciphertext: bytes) -> Any:
        """Decrypt JSON data"""
        json_str = self.decrypt(ciphertext)
        return json.loads(json_str)


# Global instance
_pii_encryption: PIIEncryption | None = None


def get_pii_encryption() -> PIIEncryption:
    global _pii_encryption
    if _pii_encryption is None:
        _pii_encryption = PIIEncryption()
    return _pii_encryption


def encrypt_field(value: str | bytes) -> bytes:
    """Convenience function to encrypt a single field"""
    return get_pii_encryption().encrypt(value)


def decrypt_field(ciphertext: bytes) -> str:
    """Convenience function to decrypt a single field"""
    return get_pii_encryption().decrypt(ciphertext)


def encrypt_json_field(value: Any) -> bytes:
    """Convenience function to encrypt JSON data"""
    return get_pii_encryption().encrypt_json(value)


def decrypt_json_field(ciphertext: bytes) -> Any:
    """Convenience function to decrypt JSON data"""
    return get_pii_encryption().decrypt_json(ciphertext)