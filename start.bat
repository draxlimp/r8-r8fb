@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title R8 Community Bot - Inicializando

cls
echo ====================================================================
echo                          R8 COMMUNITY BOT
echo                   Inicializador e monitor local
echo ====================================================================
echo.
echo Carregando painel de inicializacao...
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Windows PowerShell nao foi encontrado.
    echo.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dashboard.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo O inicializador terminou com erro %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%
