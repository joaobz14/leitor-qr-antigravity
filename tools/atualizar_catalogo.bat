@echo off
chcp 65001 > nul
cd /d "%~dp0.."

set "PYTHON_CMD="
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_CMD=.\.venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

echo ==========================================================
echo   [1/3] Criptografando planilha de dados do UpSeller...
echo ==========================================================
%PYTHON_CMD% -m tools.atualizar_catalogo
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao atualizar catalogo.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo   [2/3] Verificando seguranca do repositorio...
echo ==========================================================
%PYTHON_CMD% -m tools.repository_safety
if %errorlevel% neq 0 (
    echo [ERRO] Verificacao de seguranca falhou.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo   [3/3] Publicando automaticamente no GitHub Pages...
echo ==========================================================
git add site/data/catalogo.enc.json
git commit -m "Atualizacao automatica do catalogo"
git push origin master

if %errorlevel% equ 0 (
    echo.
    echo ==========================================================
    echo   🎉 SUCESSO! Catálogo atualizado e publicado no GitHub!
    echo   Acesse: https://joaobz14.github.io/leitor-qr-antigravity/
    echo ==========================================================
) else (
    echo [AVISO] O catalogo foi criptografado, mas houve falha ao enviar pro Git.
)

pause
