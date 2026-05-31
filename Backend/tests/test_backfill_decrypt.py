import base64
import json
import os
import sys
import unittest

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from scripts import backfill_decrypt


KEY_BYTES = b"0" * 32
KEY_B64 = base64.b64encode(KEY_BYTES).decode("ascii")
NONCE = b"1" * 12


def encrypt_fixture(value: str) -> str:
    encrypted = AESGCM(KEY_BYTES).encrypt(NONCE, value.encode("utf-8"), None)
    return base64.b64encode(NONCE + encrypted).decode("ascii")


class BackfillDecryptTests(unittest.TestCase):
    def test_keyring_decrypts_aes_gcm_payload(self):
        keyring = backfill_decrypt.Keyring.from_base64_values([KEY_B64])
        payload = encrypt_fixture("Free pizza at MSC")

        self.assertEqual(keyring.decrypt_text(payload), "Free pizza at MSC")
        self.assertIsNone(keyring.decrypt_text("Aggie User"))

    def test_decrypt_json_value_unwraps_custom_data(self):
        keyring = backfill_decrypt.Keyring.from_base64_values([KEY_B64])
        payload = {"ping_title": "Free pizza", "ping_category": "Food"}
        wrapped = {"_enc": encrypt_fixture(json.dumps(payload))}

        result, changed, failed = backfill_decrypt.decrypt_json_value(wrapped, keyring)

        self.assertTrue(changed)
        self.assertFalse(failed)
        self.assertEqual(result, payload)

    def test_decrypt_json_value_reports_failed_wrapper(self):
        keyring = backfill_decrypt.Keyring.from_base64_values([KEY_B64])

        result, changed, failed = backfill_decrypt.decrypt_json_value({"_enc": "not encrypted"}, keyring)

        self.assertFalse(changed)
        self.assertTrue(failed)
        self.assertEqual(result, {"_enc": "not encrypted"})


if __name__ == "__main__":
    unittest.main()
