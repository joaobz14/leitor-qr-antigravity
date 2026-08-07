"""
Script Inteligente para Importação e Criptografia do Catálogo de Produtos
Suporta exportações diretas do ERP UpSeller (.xlsx e .csv) e planilhas personalizadas.
"""

import sys
import os
import csv
import json
import base64
import getpass
import hashlib
from pathlib import Path

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

from datetime import datetime

def find_data_file():
    if not DADOS_LOCAIS_DIR.exists():
        DADOS_LOCAIS_DIR.mkdir(parents=True, exist_ok=True)
        print(f"📁 Diretório {DADOS_LOCAIS_DIR} criado. Adicione sua planilha do UpSeller (.xlsx ou .csv) nesta pasta.")
        sys.exit(1)

    # Coletar todos os arquivos .xlsx e .csv ignorando temporários do Excel (~$)
    all_files = []
    for ext in ["*.xlsx", "*.csv"]:
        for p in DADOS_LOCAIS_DIR.glob(ext):
            if not p.name.startswith("~$"):
                all_files.append((p, "xlsx" if p.suffix.lower() == ".xlsx" else "csv"))

    if not all_files:
        print(f"❌ Nenhum arquivo .xlsx ou .csv válido encontrado em '{DADOS_LOCAIS_DIR}'.")
        sys.exit(1)

    # Ordenar por data de modificação mais recente (mtime)
    all_files.sort(key=lambda x: x[0].stat().st_mtime, reverse=True)
    newest_file, file_type = all_files[0]

    mtime_str = datetime.fromtimestamp(newest_file.stat().st_mtime).strftime("%d/%m/%Y %H:%M:%S")
    print(f"📌 Selecionado a planilha mais recente: {newest_file.name} (Modificado em: {mtime_str})")

    if len(all_files) > 1:
        print(f"ℹ️ {len(all_files) - 1} arquivo(s) antigo(s) na pasta dados-locais/ foram ignorados automaticamente.")

    return newest_file, file_type


def parse_bool(val):
    if isinstance(val, (int, float)):
        return val > 0
    if isinstance(val, bool):
        return val
    s = (str(val) if val is not None else "").strip().lower()
    if not s:
        return True # Padrão: ativo se vazio
    return s in ["true", "1", "sim", "s", "ativo", "yes", "y", "em estoque", "normal", "publicado"]

def load_rows_from_file(filepath, file_type):
    rows = []
    
    if file_type == "xlsx":
        if not HAS_OPENPYXL:
            print("❌ Biblioteca 'openpyxl' necessária para ler .xlsx. Instale com: pip install openpyxl")
            sys.exit(1)
        wb = openpyxl.load_workbook(filepath, data_only=True)
        sheet = wb.active
        all_data = list(sheet.iter_rows(values_only=True))
        if not all_data or len(all_data) < 2:
            print(f"❌ Planilha {filepath} está vazia ou sem linhas de dados.")
            sys.exit(1)
        
        headers = [str(cell or "").strip() for cell in all_data[0]]
        for row_tuple in all_data[1:]:
            row_dict = {headers[i]: row_tuple[i] for i in range(min(len(headers), len(row_tuple)))}
            rows.append(row_dict)

    elif file_type == "csv":
        with open(filepath, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(dict(row))

    return rows

def map_products(rows, filepath):
    products = []
    seen_skus = set()

    if not rows:
        print("❌ Nenhuma linha encontrada na planilha.")
        sys.exit(1)

    headers = list(rows[0].keys())

    # Detectar Mapeamento de Colunas
    col_map = {}
    for target_field in ["nome", "sku", "variacao", "voltagem", "categoria", "qr_code_valor", "ativo"]:
        matched_col = None
        for h in headers:
            if match_column(h, target_field):
                matched_col = h
                break
        col_map[target_field] = matched_col

    print(f"\n🔍 Mapeamento automático de colunas para '{filepath.name}':")
    for target_field, matched_col in col_map.items():
        status = f"-> coluna '{matched_col}'" if matched_col else "(usará valor padrão/fallback)"
        print(f"  • {target_field.upper()}: {status}")

    if not col_map["sku"]:
        print("❌ Não foi possível identificar a coluna de SKU (ex: 'SKU', 'SKU da Variante', 'Código').")
        sys.exit(1)
    
    if not col_map["nome"]:
        print("❌ Não foi possível identificar a coluna de Nome (ex: 'Nome do produto', 'Título').")
        sys.exit(1)

    for line_num, row in enumerate(rows, start=2):
        raw_sku = row.get(col_map["sku"]) if col_map["sku"] else None
        raw_nome = row.get(col_map["nome"]) if col_map["nome"] else None
        
        sku = (str(raw_sku) if raw_sku is not None else "").strip()
        nome = (str(raw_nome) if raw_nome is not None else "").strip()

        if not sku or not nome:
            continue

        sku_upper = sku.upper()
        if sku_upper in seen_skus:
            print(f"⚠️ Aviso: SKU duplicado na linha {line_num} ('{sku}'). Ignorando duplicação.")
            continue
        seen_skus.add(sku_upper)

        # Tratar variacao, voltagem, categoria
        variacao = (str(row.get(col_map["variacao"])) if col_map["variacao"] and row.get(col_map["variacao"]) is not None else "").strip()
        voltagem = (str(row.get(col_map["voltagem"])) if col_map["voltagem"] and row.get(col_map["voltagem"]) is not None else "").strip()
        categoria = (str(row.get(col_map["categoria"])) if col_map["categoria"] and row.get(col_map["categoria"]) is not None else "").strip() or "Geral"

        # Valor do QR Code (fallback para o próprio SKU se não houver coluna de QR Code)
        raw_qr = row.get(col_map["qr_code_valor"]) if col_map["qr_code_valor"] else None
        qr_val = (str(raw_qr) if raw_qr is not None else "").strip() or sku

        # Ativo
        ativo = parse_bool(row.get(col_map["ativo"])) if col_map["ativo"] else True

        products.append({
            "nome": nome,
            "sku": sku,
            "variacao": variacao,
            "voltagem": voltagem,
            "categoria": categoria,
            "qr_code_valor": qr_val,
            "ativo": ativo
        })

    print(f"\n📦 {len(products)} produtos válidos processados do UpSeller/Planilha.")
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
        "updated_at": "hoje",
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

PIN_CONFIG_FILE = Path(__file__).resolve().parent.parent / "dados-locais" / ".pin_config.json"

def get_or_create_passphrase():
    if PIN_CONFIG_FILE.exists():
        try:
            pin_data = json.loads(PIN_CONFIG_FILE.read_text(encoding="utf-8"))
            pin = getpass.getpass("\n🔑 Digite seu PIN rápido (ex: 1234): ").strip()

            salt = base64.b64decode(pin_data["salt"])
            iv = base64.b64decode(pin_data["iv"])
            ciphertext = base64.b64decode(pin_data["enc_passphrase"])

            pin_key = hashlib.pbkdf2_hmac('sha256', pin.encode('utf-8'), salt, ITERATIONS, dklen=KEY_SIZE)
            aesgcm = AESGCM(pin_key)
            passphrase_bytes = aesgcm.decrypt(iv, ciphertext, None)
            passphrase = passphrase_bytes.decode('utf-8')
            print("✅ PIN validado com sucesso!")
            return passphrase
        except Exception:
            print("❌ PIN incorreto ou arquivo de configuração corrompido.")
            if PIN_CONFIG_FILE.exists():
                PIN_CONFIG_FILE.unlink()
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
    filepath, file_type = find_data_file()
    print(f"📖 Lendo arquivo de dados: {filepath.name} ({file_type.upper()})")

    rows = load_rows_from_file(filepath, file_type)
    products = map_products(rows, filepath)

    if not products:
        print("❌ Nenhum produto válido encontrado na planilha.")
        sys.exit(1)

    passphrase = get_or_create_passphrase()

    encrypted_data = encrypt_catalog(products, passphrase)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(encrypted_data, f, indent=2)

    print(f"\n🎉 Catálogo criptografado salvo com sucesso em: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
