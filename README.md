# Catálogo QR (Versão Antigravity PRO)

Aplicação web estática, responsiva e de alta performance para consulta de produtos e exibição de QR Codes com **criptografia de ponta a ponta** (AES-256-GCM + PBKDF2), pronta para hospedagem gratuita no **GitHub Pages**.

---

## 🚀 Diferenciais da Versão Antigravity

- **Design System Cyber Luxe Glassmorphic**: Interface visualmente impressionante com suporte nativo a modo escuro/claro, tipografia *Outfit* + *Inter* e micro-animações.
- **Scanner de Câmera Integrado**: Leitura em tempo real de QR Codes físicos através da câmera do celular/computador com busca instantânea.
- **Impressão em Lote**: Seleção múltipla de itens para geração automatizada de folha de etiquetas QR prontas para impressão.
- **Visualizador HD & Modo Projeção**: Modal com geração em alta definição, personalização e projeção em tela cheia para estoques e galpões.
- **Filtros por Categoria & Busca Fuzzy**: Destaque visual dos termos pesquisados com contadores dinâmicos.
- **Security Gatekeeper (`repository_safety.py`)**: Script automatizado que impede o commit acidental de arquivos sensíveis ou planilhas CSV.

---

## 📂 Estrutura do Projeto

- `site/`: Aplicação web estática pública (HTML, CSS, JS e dados cifrados `catalogo.enc.json`).
- `tools/`: Scripts em Python e lote (`.bat`) para criptografia do CSV, re-criptografia e segurança.
- `dados-locais/`: Diretório reservado para guardar o arquivo `produtos.csv` localmente (ignorado pelo Git).
- `tests/`: Suíte de testes unitários e de integração.

---

## ⚡ Como Usar

### 1. Configurar o Ambiente no Windows
Clique duas vezes em:
```bat
tools\configurar_windows.bat
```

### 2. Preencher os Produtos no CSV Local
Edite o arquivo `dados-locais\produtos.csv` informando os produtos:
```csv
nome,sku,variacao,voltagem,categoria,qr_code_valor,ativo
Liquidificador Turbo,A01,Preto,127 V,Cozinha,A01,sim
```

### 3. Criptografar e Atualizar o Catálogo
Clique duas vezes em:
```bat
tools\atualizar_catalogo.bat
```
Informe sua frase de acesso de pelo menos 16 caracteres. O script gerará o arquivo cifrado em `site/data/catalogo.enc.json` e executará o gate de segurança.

---

## 🛡️ Segurança

- O arquivo `dados-locais/produtos.csv` é **estritamente ignorado pelo Git**.
- O repositório público armazena apenas o código estático e o arquivo JSON cifrado.
- A descriptografia ocorre **exclusivamente na memória do navegador do usuário**.
