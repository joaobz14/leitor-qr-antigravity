"""
Script Inteligente para Importação e Criptografia do Catálogo de Produtos
Suporta exportações diretas do ERP UpSeller (.xlsx e .csv) e combina múltiplas planilhas.
"""

import sys
import os
import csv
import json
import base64
import getpass
import hashlib
from datetime import datetime
from pathlib import Path

# Garantir codificação UTF-8 no console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    print("❌ Dependência 'cryptography' não encontrada. Instale com: pip install cryptography")
    sys.exit(1)

# Suporte nativo para planilhas Excel (.xlsx)
HAS_OPENPYXL = False
try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    pass

DADOS_LOCAIS_DIR = Path("dados-locais")
OUTPUT_PATH = Path("site/data/catalogo.enc.json")
PIN_CONFIG_FILE = Path(__file__).resolve().parent.parent / "dados-locais" / ".pin_config.json"

ITERATIONS = 100000
KEY_SIZE = 32

# Mapeamento Inteligente de Colunas (UpSeller ERP + Padrão)
COLUMN_MAPPINGS = {
    "nome": ["nome", "nome do produto", "product name", "titulo", "título", "descrição", "descricao"],
    "sku": ["sku", "variant sku", "sku da variante", "sku pai", "código", "codigo", "item sku"],
    "variacao": ["variacao", "variação", "variant", "variantes", "cor", "tamanho", "atributo", "atributos"],
    "voltagem": ["voltagem", "tensao", "tensão", "voltage"],
    "categoria": ["categoria", "category", "departamento", "linha", "marca"],
    "qr_code_valor": ["qr_code_valor", "qrcode", "qr code", "codigo de barras", "código de barras", "ean", "gtin"],
    "ativo": ["ativo", "status", "estoque", "em estoque", "active", "disponivel", "disponível"]
}

def normalize_header(header_name):
    if not header_name:
        return ""
    return str(header_name).strip().lower()

def match_column(header, target_field):
    normalized = normalize_header(header)
    possible_names = COLUMN_MAPPINGS.get(target_field, [target_field])
    return normalized in possible_names

def parse_bool(val):
    if isinstance(val, (int, float)):
        return val > 0
    if isinstance(val, bool):
        return val
    s = (str(val) if val is not None else "").strip().lower()
    if not s:
        return True
    return s in ["true", "1", "sim", "s", "ativo", "yes", "y", "em estoque", "normal", "publicado"]

def load_rows_from_file(filepath, file_type):
    rows = []
    if file_type == "xlsx":
        if not HAS_OPENPYXL:
            print("❌ openpyxl não instalado. Instale com: pip install openpyxl")
            sys.exit(1)
        wb = openpyxl.load_workbook(filepath, data_only=True)
        sheet = wb.active
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None for cell in row):
                rows.append([str(c) if c is not None else "" for c in row])
    else:
        with open(filepath, "r", encoding="utf-8-sig", errors="ignore") as f:
            sample = f.read(2048)
            f.seek(0)
            delimiter = ";" if ";" in sample else ","
            reader = csv.reader(f, delimiter=delimiter)
            for row in reader:
                if any(cell.strip() for cell in row):
                    rows.append(row)
    return rows

def map_products(rows, filepath):
    if not rows:
        return []

    headers = rows[0]
    col_indexes = {}

    for field in COLUMN_MAPPINGS.keys():
        for idx, header in enumerate(headers):
            if match_column(header, field):
                col_indexes[field] = idx
                break

    print(f"   📋 Mapeamento para '{filepath.name}':")
    for field, idx in col_indexes.items():
        print(f"     • {field.upper()}: -> coluna '{headers[idx]}'")

    products = []
    for row in rows[1:]:
        def get_val(field_name, default=""):
            idx = col_indexes.get(field_name)
            if idx is not None and idx < len(row):
                val = str(row[idx]).strip()
                return val if val != "" else default
            return default

        nome = get_val("nome")
        sku = get_val("sku")

        if not nome and not sku:
            continue

        if not nome:
            nome = f"Produto {sku}"
        if not sku:
            sku = f"SKU-{hashlib.md5(nome.encode()).hexdigest()[:6]}"

        variacao = get_val("variacao")
        voltagem = get_val("voltagem")
        categoria = get_val("categoria", "Geral")
        qr_val = get_val("qr_code_valor", sku)
        ativo = parse_bool(get_val("ativo", "true"))

        products.append({
            "nome": nome,
            "sku": sku,
            "variacao": variacao,
            "voltagem": voltagem,
            "categoria": categoria,
            "qr_code_valor": qr_val,
            "ativo": ativo
        })

    return products

def encrypt_catalog(products, passphrase):
    salt = os.urandom(16)
    iv = os.urandom(12)

    key = hashlib.pbkdf2_hmac(
        'sha256',
        passphrase.encode('utf-8'),
        salt,
        ITERATIONS,
        dklen=KEY_SIZE
    )

    payload_json = json.dumps({
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_items": len(products),
        "products": products
    }, ensure_ascii=False)

    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, payload_json.encode('utf-8'), None)

    return {
        "version": "2.0-antigravity-upseller",
        "kdf": "PBKDF2",
        "hash": "SHA-256",
        "iterations": ITERATIONS,
        "salt": base64.b64encode(salt).decode('utf-8'),
        "iv": base64.b64encode(iv).decode('utf-8'),
        "ciphertext": base64.b64encode(ciphertext).decode('utf-8')
    }

def get_all_data_files():
    if not DADOS_LOCAIS_DIR.exists():
        DADOS_LOCAIS_DIR.mkdir(parents=True, exist_ok=True)
        print(f"📁 Diretório {DADOS_LOCAIS_DIR} criado. Adicione suas planilhas do UpSeller (.xlsx ou .csv) nesta pasta.")
        sys.exit(1)

    all_files = []
    for ext in ["*.xlsx", "*.csv"]:
        for p in DADOS_LOCAIS_DIR.glob(ext):
            if not p.name.startswith("~$"):
                all_files.append((p, "xlsx" if p.suffix.lower() == ".xlsx" else "csv"))

    if not all_files:
        print(f"❌ Nenhum arquivo .xlsx ou .csv válido encontrado em '{DADOS_LOCAIS_DIR}'.")
        sys.exit(1)

    # Ordenar por data de modificação (mais antigos primeiro para que planilhas mais recentes se sobressaiam em SKUs duplicados)
    all_files.sort(key=lambda x: x[0].stat().st_mtime)
    return all_files

def get_or_create_passphrase():
    if PIN_CONFIG_FILE.exists():
        try:
            pin_data = json.loads(PIN_CONFIG_FILE.read_text(encoding="utf-8"))
            salt = base64.b64decode(pin_data["salt"])
            iv = base64.b64decode(pin_data["iv"])
            ciphertext = base64.b64decode(pin_data["enc_passphrase"])
        except Exception:
            print("⚠️ Arquivo de configuração de PIN corrompido. Removendo arquivo inválido...")
            if PIN_CONFIG_FILE.exists():
                PIN_CONFIG_FILE.unlink()

        if PIN_CONFIG_FILE.exists():
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    pin = getpass.getpass(f"\n🔑 Digite seu PIN rápido (Tentativa {attempt}/{max_attempts}): ").strip()
                    pin_key = hashlib.pbkdf2_hmac('sha256', pin.encode('utf-8'), salt, ITERATIONS, dklen=KEY_SIZE)
                    aesgcm = AESGCM(pin_key)
                    passphrase_bytes = aesgcm.decrypt(iv, ciphertext, None)
                    passphrase = passphrase_bytes.decode('utf-8')
                    print("✅ PIN validado com sucesso!")
                    return passphrase
                except Exception:
                    if attempt < max_attempts:
                        print("❌ PIN incorreto. Tente novamente.")
                    else:
                        print("❌ Número máximo de tentativas excedido. O seu PIN continua salvo.")
                        sys.exit(1)


    print("\n💡 DICA: Você pode cadastrar um PIN rápido (ex: 1234) para não ter que digitar a senha completa nas próximas atualizações.")
    use_pin_input = input("Deseja cadastrar um PIN rápido agora? (S/N) [Padrão: S]: ").strip().lower()
    use_pin = use_pin_input in ["", "s", "sim", "y", "yes"]

    passphrase = getpass.getpass("\nDigite a frase de acesso completa (mínimo 16 caracteres): ").strip()
    if len(passphrase) < 16:
        print("❌ A frase de acesso deve conter pelo menos 16 caracteres.")
        sys.exit(1)

    confirm_passphrase = getpass.getpass("Confirme a frase de acesso completa: ").strip()
    if passphrase != confirm_passphrase:
        print("❌ As frases de acesso não coincidem.")
        sys.exit(1)

    if use_pin:
        new_pin = getpass.getpass("\nDigite o seu novo PIN numérico (ex: 1234): ").strip()
        confirm_pin = getpass.getpass("Confirme o seu PIN numérico: ").strip()

        if not new_pin or new_pin != confirm_pin:
            print("⚠️ PIN inválido ou confirmação divergente. O PIN não foi salvo.")
        else:
            salt = os.urandom(16)
            iv = os.urandom(12)
            pin_key = hashlib.pbkdf2_hmac('sha256', new_pin.encode('utf-8'), salt, ITERATIONS, dklen=KEY_SIZE)
            aesgcm = AESGCM(pin_key)
            ciphertext = aesgcm.encrypt(iv, passphrase.encode('utf-8'), None)

            pin_payload = {
                "salt": base64.b64encode(salt).decode('utf-8'),
                "iv": base64.b64encode(iv).decode('utf-8'),
                "enc_passphrase": base64.b64encode(ciphertext).decode('utf-8')
            }
            PIN_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
            PIN_CONFIG_FILE.write_text(json.dumps(pin_payload, indent=2), encoding="utf-8")
            print(f"🎉 PIN rápido salvo localmente em '{PIN_CONFIG_FILE.name}'! Nas próximas atualizações, você precisará apenas do seu PIN.")

    return passphrase

def main():
    print("=== Antigravity UpSeller ERP Catalog Encryptor ===")
    data_files = get_all_data_files()
    print(f"📁 Encontrada(s) {len(data_files)} planilha(s) para combinar em 'dados-locais/':\n")

    all_products_by_sku = {}
    total_raw_count = 0

    for idx, (filepath, file_type) in enumerate(data_files, 1):
        mtime_str = datetime.fromtimestamp(filepath.stat().st_mtime).strftime("%d/%m/%Y %H:%M:%S")
        print(f" [{idx}/{len(data_files)}] 📖 Lendo: {filepath.name} (Modificado em: {mtime_str})")

        try:
            rows = load_rows_from_file(filepath, file_type)
            products = map_products(rows, filepath)
            total_raw_count += len(products)

            for prod in products:
                sku_val = (prod.get("sku") or "").strip().lower()
                if sku_val:
                    all_products_by_sku[sku_val] = prod
                else:
                    name_val = (prod.get("nome") or "").strip().lower()
                    all_products_by_sku[name_val] = prod

            print(f"     ✅ +{len(products)} produto(s) extraído(s) deste arquivo.\n")
        except Exception as err:
            print(f"     ❌ Erro ao ler a planilha '{filepath.name}': {err}\n")

    final_products = list(all_products_by_sku.values())

    if not final_products:
        print("❌ Nenhum produto válido encontrado nas planilhas.")
        sys.exit(1)

    print(f"📦 TOTAL COMBINADO: {len(final_products)} produtos únicos unificados a partir das {len(data_files)} planilhas.")

    passphrase = get_or_create_passphrase()

    encrypted_data = encrypt_catalog(final_products, passphrase)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(encrypted_data, f, indent=2)

    print(f"\n🎉 Catálogo criptografado salvo com sucesso em: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
