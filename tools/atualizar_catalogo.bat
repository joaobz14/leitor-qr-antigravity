@echo off
chcp 65001 > nul
cd /d "%~dp0.."

set "PYTHON_CMD="
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_CMD=.\.venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

%PYTHON_CMD% -m tools.atualizar_catalogo
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao atualizar catalogo.
    pause
    exit /b 1
)

%PYTHON_CMD% -m tools.repository_safety
pause
