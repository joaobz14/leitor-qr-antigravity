"""
Servidor Local para Celular / Dispositivos na Rede (Cabo ou Wi-Fi) - Antigravity Edition
Detecta automaticamente o IP local do computador (funciona com Cabo Ethernet ou Wi-Fi)
e exibe a URL pronta para conectar no celular.
"""

import sys
import os
import socket
import http.server
import socketserver
from pathlib import Path

# Garantir codificação UTF-8 no console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 8000
SITE_DIR = Path("site").resolve()

def get_all_local_ips():
    ips = set()
    
    # Método 1: Socket externo para a interface padrão ativa (Cabo ou Wi-Fi)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        primary_ip = s.getsockname()[0]
        s.close()
        if primary_ip and not primary_ip.startswith("127."):
            ips.add(primary_ip)
    except Exception:
        pass

    # Método 2: Listar todas as interfaces de rede do sistema
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and not ip.startswith("169.254."):
                ips.add(ip)
    except Exception:
        pass

    return list(ips) if ips else ["127.0.0.1"]

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

def main():
    os.chdir(SITE_DIR.parent)
    local_ips = get_all_local_ips()

    print("=" * 65)
    print(" 📱 SERVIDOR LOCAL PARA CELULAR (CONEXÃO CABO ETHERNET OU WI-FI)")
    print("=" * 65)
    print("\n✅ Servidor iniciado com sucesso!")
    print("   (O PC no cabo e o celular no Wi-Fi estão no mesmo roteador)\n")
    print("👉 Abra o navegador do celular e digite uma das URLs abaixo:\n")

    for ip in local_ips:
        print(f"   ► http://{ip}:{PORT}")

    print("\n  (Para encerrar o servidor, aperte Ctrl + C nesta janela)\n")
    print("=" * 65)

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Servidor encerrado.")
    except Exception as e:
        print(f"\n❌ Erro ao iniciar servidor na porta {PORT}: {e}")

if __name__ == "__main__":
    main()
