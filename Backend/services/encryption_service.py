import os
import secrets
import base64
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from typing import Optional, Any

_aesgcm: Optional[AESGCM] = None

def _get_cipher() -> AESGCM:
    global _aesgcm
    if _aesgcm is None:
        key_b64 = os.environ.get("AES_ENCRYPTION_KEY")
        if not key_b64:
            # Fallback or strict requirement based on .env
            # We will generate one and print a big warning if it doesn't exist
            print("WARNING: 'AES_ENCRYPTION_KEY' not found in environment! Encrypted fields will fail.")
            raise ValueError("AES_ENCRYPTION_KEY must be set to a valid base64 256-bit key.")
        
        try:
            key_bytes = base64.b64decode(key_b64)
            if len(key_bytes) != 32:
                raise ValueError("AES_ENCRYPTION_KEY must be exactly 32 bytes (256-bit) after decoding.")
            _aesgcm = AESGCM(key_bytes)
        except Exception as exc:
            raise ValueError(f"Failed to initialize AESGCM cipher block: {exc}")
    
    return _aesgcm

def encrypt_string(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    
    cipher = _get_cipher()
    nonce = secrets.token_bytes(12) # Standard AES-GCM nonce size
    ciphertext = cipher.encrypt(nonce, plaintext.encode('utf-8'), None)
    
    # Prepend the nonce to the ciphertext and encode to base64 for safe string storage
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode('utf-8')

def decrypt_string(encrypted_b64: str) -> str:
    if not encrypted_b64:
        return encrypted_b64
        
    try:
        combined = base64.b64decode(encrypted_b64)
        if len(combined) < 12:
            return encrypted_b64 # Not a valid encrypted payload
            
        nonce = combined[:12]
        ciphertext = combined[12:]
        
        cipher = _get_cipher()
        plaintext = cipher.decrypt(nonce, ciphertext, None)
        return plaintext.decode('utf-8')
    except Exception as exc:
        # If decryption fails (e.g. legacy unencrypted text), return the original
        # However, it's safer to log this so we know what failed
        return encrypted_b64

def encrypt_json(payload: dict) -> str:
    """Takes a dictionary and returns a base64 encrypted JSON string."""
    if not payload:
        return json.dumps(payload)
    return encrypt_string(json.dumps(payload))

def decrypt_json(encrypted_b64: str) -> dict:
    """Takes a base64 encrypted JSON string and returns the parsed dictionary."""
    if not encrypted_b64:
        return {}
    decrypted_str = decrypt_string(encrypted_b64)
    try:
        return json.loads(decrypted_str)
    except json.JSONDecodeError:
        return {}
