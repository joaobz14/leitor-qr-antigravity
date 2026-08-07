@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
echo ===================================================
echo   Configurador Antigravity - Catálogo QR
echo ===================================================

cd /d "%~dp0.."

echo [1/4] Verificando Python...
py -3 --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python 3 não encontrado! Por favor instale o Python.
    pause
    exit /b 1
)

if not exist ".venv" (
    echo [2/4] Criando ambiente virtual .venv...
    py -3 -m venv .venv
)

echo [3/4] Instalando dependências de ferramentas...
.\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
.\.venv\Scripts\python.exe -m pip install --quiet -r requirements-tools.txt

echo [4/4] Instalando dependências Node e Vendor...
call npm install
call npm run vendor

echo ===================================================
echo   ✅ Configuração concluída com sucesso!
echo ===================================================
pause
