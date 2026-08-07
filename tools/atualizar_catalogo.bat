@echo off
cd /d "%~dp0.."

set "PYTHON_CMD=python"
if exist ".venv\Scripts\python.exe" set "PYTHON_CMD=.\.venv\Scripts\python.exe"

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

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] O catalogo foi criptografado, mas houve falha no envio ao Git.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo   SUCESSO! Catalogo atualizado e publicado no GitHub!
echo   Acesse: https://joaobz14.github.io/leitor-qr-antigravity/
echo ==========================================================
pause
