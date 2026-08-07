"""
Script para Trocar a Frase de Acesso do Catálogo
Descriptografa o catálogo atual com a senha antiga e re-criptografa com a nova frase de acesso.
"""

import sys
import os
import json
import base64
import getpass
import hashlib
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

OUTPUT_PATH = Path("site/data/catalogo.enc.json")

def decrypt_catalog(enc_data, passphrase):
    salt = base64.b64decode(enc_data["salt"])
    iv = base64.b64decode(enc_data["iv"])
    ciphertext = base64.b64decode(enc_data["ciphertext"])
    iterations = enc_data.get("iterations", 100000)

    key = hashlib.pbkdf2_hmac(
        'sha256',
        passphrase.encode('utf-8'),
        salt,
        iterations,
        dklen=32
    )

    aesgcm = AESGCM(key)
    plaintext_bytes = aesgcm.decrypt(iv, ciphertext, None)
    return json.loads(plaintext_bytes.decode('utf-8'))

def encrypt_catalog(payload_dict, passphrase):
    salt = os.urandom(16)
    iv = os.urandom(12)
    iterations = 100000

    key = hashlib.pbkdf2_hmac(
        'sha256',
        passphrase.encode('utf-8'),
        salt,
        iterations,
        dklen=32
    )

    payload_json = json.dumps(payload_dict, ensure_ascii=False)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, payload_json.encode('utf-8'), None)

    return {
        "version": "2.0-antigravity",
        "kdf": "PBKDF2",
        "hash": "SHA-256",
        "iterations": iterations,
        "salt": base64.b64encode(salt).decode('utf-8'),
        "iv": base64.b64encode(iv).decode('utf-8'),
        "ciphertext": base64.b64encode(ciphertext).decode('utf-8')
    }

def main():
    print("=== Trocar Frase de Acesso do Catálogo ===")
    if not OUTPUT_PATH.exists():
        print(f"❌ Arquivo cifrado não encontrado em {OUTPUT_PATH}")
        sys.exit(1)

    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        enc_data = json.load(f)

    old_pass = getpass.getpass("Digite a frase de acesso ATUAL: ")
    try:
        payload = decrypt_catalog(enc_data, old_pass)
        print("✅ Frase de acesso atual validada com sucesso.")
    except Exception:
        print("❌ Frase de acesso atual incorreta.")
        sys.exit(1)

    new_pass = getpass.getpass("Digite a NOVA frase de acesso (mínimo 16 caracteres): ")
    if len(new_pass) < 16:
        print("❌ A nova frase de acesso deve conter pelo menos 16 caracteres.")
        sys.exit(1)

    confirm_pass = getpass.getpass("Confirme a NOVA frase de acesso: ")
    if new_pass != confirm_pass:
        print("❌ As confirmações não coincidem.")
        sys.exit(1)

    new_enc_data = encrypt_catalog(payload, new_pass)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(new_enc_data, f, indent=2)

    print("🎉 Frase de acesso alterada e catálogo re-criptografado com sucesso!")

if __name__ == "__main__":
    main()
