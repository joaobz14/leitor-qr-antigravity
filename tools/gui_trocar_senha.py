"""
Interface Gráfica Simples para Troca de Senha do Catálogo QR
Antigravity Edition - Janela Visual Prática para Windows
"""

import sys
import os
import json
import base64
import hashlib
from pathlib import Path

# Tentativa de importar Tkinter para GUI visual
HAS_TKINTER = False
try:
    import tkinter as tk
    from tkinter import messagebox, ttk
    HAS_TKINTER = True
except ImportError:
    pass

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    print("❌ Dependência 'cryptography' não encontrada. Instale com: pip install cryptography")
    sys.exit(1)

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

def run_gui():
    if not OUTPUT_PATH.exists():
        messagebox.showerror("Erro", f"Arquivo de catálogo cifrado não encontrado em: {OUTPUT_PATH}")
        sys.exit(1)

    root = tk.Tk()
    root.title("Catálogo QR • Trocar Senha")
    root.geometry("420x340")
    root.resizable(False, False)
    root.configure(bg="#0b0d17")

    # Centralizar Janela
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f'{width}x{height}+{x}+{y}')

    # Estilos
    style = ttk.Style()
    style.theme_use('default')

    header_label = tk.Label(
        root,
        text="🔑 Trocar Senha do Catálogo",
        font=("Helvetica", 14, "bold"),
        fg="#f8fafc",
        bg="#0b0d17"
    )
    header_label.pack(pady=(20, 10))

    sub_label = tk.Label(
        root,
        text="Digite a senha atual e a nova frase de acesso:",
        font=("Helvetica", 9),
        fg="#94a3b8",
        bg="#0b0d17"
    )
    sub_label.pack(pady=(0, 15))

    frame = tk.Frame(root, bg="#0b0d17")
    frame.pack(padx=20, fill="x")


    # Campos
    tk.Label(frame, text="Senha Atual:", font=("Helvetica", 9, "bold"), fg="#94a3b8", bg="#0b0d17", anchor="w").pack(fill="x")
    entry_old = tk.Entry(frame, show="•", font=("Helvetica", 10), bg="#181c2e", fg="#ffffff", insertbackground="white", bd=1, relief="solid")
    entry_old.pack(fill="x", ipady=4, pady=(2, 8))

    tk.Label(frame, text="Nova Senha (mínimo 16 caracteres):", font=("Helvetica", 9, "bold"), fg="#94a3b8", bg="#0b0d17", anchor="w").pack(fill="x")
    entry_new = tk.Entry(frame, show="•", font=("Helvetica", 10), bg="#181c2e", fg="#ffffff", insertbackground="white", bd=1, relief="solid")
    entry_new.pack(fill="x", ipady=4, pady=(2, 8))

    tk.Label(frame, text="Confirmar Nova Senha:", font=("Helvetica", 9, "bold"), fg="#94a3b8", bg="#0b0d17", anchor="w").pack(fill="x")
    entry_confirm = tk.Entry(frame, show="•", font=("Helvetica", 10), bg="#181c2e", fg="#ffffff", insertbackground="white", bd=1, relief="solid")
    entry_confirm.pack(fill="x", ipady=4, pady=(2, 12))

    def on_submit():
        old_pass = entry_old.get().strip()
        new_pass = entry_new.get().strip()
        confirm_pass = entry_confirm.get().strip()

        if not old_pass:
            messagebox.showwarning("Aviso", "Por favor informe a senha atual.")
            return

        if len(new_pass) < 16:
            messagebox.showwarning("Aviso", "A nova senha deve ter no mínimo 16 caracteres.")
            return

        if new_pass != confirm_pass:
            messagebox.showwarning("Aviso", "A confirmação da nova senha não coincide.")
            return

        try:
            with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
                enc_data = json.load(f)

            payload = decrypt_catalog(enc_data, old_pass)
            new_enc_data = encrypt_catalog(payload, new_pass)

            with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
                json.dump(new_enc_data, f, indent=2)

            messagebox.showinfo("Sucesso 🎉", "Senha do catálogo alterada com sucesso!")
            root.destroy()
        except Exception:
            messagebox.showerror("Erro ❌", "Senha atual incorreta ou falha na re-criptografia.")

    btn_submit = tk.Button(
        frame,
        text="ALTERAR SENHA AGORA",
        font=("Helvetica", 10, "bold"),
        fg="#ffffff",
        bg="#6366f1",
        activebackground="#4f46e5",
        activeforeground="#ffffff",
        bd=0,
        cursor="hand2",
        command=on_submit
    )
    btn_submit.pack(fill="x", ipady=8, pady=(5, 0))

    root.mainloop()

if __name__ == "__main__":
    if HAS_TKINTER:
        run_gui()
    else:
        # Fallback CLI se Tkinter não estiver disponível
        import tools.trocar_frase as cli_tool
        cli_tool.main()
