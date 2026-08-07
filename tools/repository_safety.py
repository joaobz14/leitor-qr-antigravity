"""
Repository Safety & Security Gatekeeper - Antigravity Edition
Valida a integridade do repositório, protege arquivos sensíveis (CSV, chaves, backups)
e impede vazamentos no Git.
"""

import sys
import os
import json
import subprocess
from pathlib import Path

# Garantir codificação UTF-8 no stdout/stderr no Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


# Allowlist exata para o diretório site/
SITE_ALLOWLIST = {
    "site/index.html",
    "site/manifest.json",
    "site/sw.js",
    "site/assets/css/app.css",
    "site/assets/js/app.js",
    "site/assets/js/catalog.js",
    "site/assets/js/crypto.js",
    "site/assets/js/qr-view.js",
    "site/assets/js/search.js",
    "site/assets/js/shortcuts.js",
    "site/assets/js/storage.js",
    "site/assets/js/camera-scanner.js",
    "site/assets/js/print-batch.js",
    "site/assets/js/audio-feedback.js",
    "site/assets/js/clipboard.js",
    "site/assets/js/dashboard.js",
    "site/assets/vendor/qrcode.js",
    "site/data/catalogo.enc.json",
}


FORBIDDEN_PATTERNS = [
    "dados-locais/",
    "backups/",
    ".env",
    "produtos.csv",
    ".key",
    ".pem",
]

def run_git_cmd(args):
    try:
        res = subprocess.run(["git"] + args, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        return None

def check_sensitive_files():
    print("[1/3] Verificando se arquivos sensíveis foram indexados no Git...")
    tracked_files = run_git_cmd(["ls-files"])
    if not tracked_files:
        print("  - Aviso: Repositório Git não inicializado ou sem arquivos indexados ainda.")
        return True
    
    lines = tracked_files.splitlines()
    violations = []
    for line in lines:
        for pattern in FORBIDDEN_PATTERNS:
            if pattern in line:
                violations.append(line)
                
    if violations:
        print(f"❌ ERRO GRAVE: Arquivos sensíveis encontrados no Git:\n  " + "\n  ".join(violations))
        return False
    print("  ✅ Nenhum arquivo sensível indexado.")
    return True

def check_site_allowlist():
    print("[2/3] Verificando se o diretório site/ está na allowlist...")
    site_dir = Path("site")
    if not site_dir.exists():
        print("❌ ERRO: Diretório site/ não encontrado.")
        return False

    current_site_files = set()
    for root, _, files in os.walk(site_dir):
        for f in files:
            rel_path = Path(root, f).as_posix()
            current_site_files.add(rel_path)

    extra_files = current_site_files - SITE_ALLOWLIST
    missing_files = SITE_ALLOWLIST - current_site_files

    if extra_files:
        print("❌ ERRO: Arquivos não autorizados em site/:\n  " + "\n  ".join(extra_files))
        return False
    
    if missing_files:
        print("❌ ERRO: Arquivos obrigatórios ausentes em site/:\n  " + "\n  ".join(missing_files))
        return False

    print("  ✅ Estrutura de site/ perfeitamente alinhada com a allowlist.")
    return True

def check_encrypted_data():
    print("[3/3] Validando estrutura de site/data/catalogo.enc.json...")
    enc_file = Path("site/data/catalogo.enc.json")
    if not enc_file.exists():
        print("❌ ERRO: Arquivo catalogo.enc.json não existe.")
        return False

    try:
        data = json.loads(enc_file.read_text(encoding="utf-8"))
        if "version" not in data or "salt" not in data or "iv" not in data or "ciphertext" not in data:
            if data.get("placeholder") is not True:
                print("❌ ERRO: Estrutura inválida de catalogo.enc.json.")
                return False
        print("  ✅ Arquivo catalogo.enc.json estruturalmente válido.")
        return True
    except Exception as e:
        print(f"❌ ERRO ao ler catalogo.enc.json: {e}")
        return False

def main():
    print("=== Antigravity Security Gate ===")
    v1 = check_sensitive_files()
    v2 = check_site_allowlist()
    v3 = check_encrypted_data()

    if v1 and v2 and v3:
        print("\n🎉 Todos os testes de segurança passaram com sucesso!")
        sys.exit(0)
    else:
        print("\n❌ Falha na verificação de segurança. Corrija os problemas acima.")
        sys.exit(1)

if __name__ == "__main__":
    main()
