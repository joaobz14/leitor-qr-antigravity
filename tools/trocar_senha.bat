@echo off
chcp 65001 > nul
cd /d "%~dp0.."

set "PYTHON_CMD="
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_CMD=.\.venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

%PYTHON_CMD% -m tools.gui_trocar_senha
if %errorlevel% neq 0 (
    exit /b 1
)

%PYTHON_CMD% -m tools.repository_safety
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

git add site/data/catalogo.enc.json
git commit -m "Atualizacao de senha do catalogo"
git push origin master

pause
