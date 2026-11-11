@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Bordena - Desktop Development
if exist "%~dp0.tools\node\node.exe" set "PATH=%~dp0.tools\node;%~dp0.tools\bin;%PATH%"
if exist "%~dp0.tools\cargo\bin\cargo.exe" (
  set "RUSTUP_HOME=%~dp0.tools\rustup"
  set "CARGO_HOME=%~dp0.tools\cargo"
  set "PATH=%~dp0.tools\cargo\bin;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  echo Требуется Node.js 22 или новее.
  if not defined BORDENA_TEST_PROFILE pause
  exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Требуется pnpm 11.25.0: npm install -g pnpm@11.25.0
  if not defined BORDENA_TEST_PROFILE pause
  exit /b 1
)
if not exist "apps\client\node_modules\.bin\vite.CMD" (
  call pnpm install --frozen-lockfile --offline
  if errorlevel 1 (
    if not defined BORDENA_TEST_PROFILE pause
    exit /b 1
  )
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo Требуется Rust MSVC. См. docs\WINDOWS_INSTALL.md
  if not defined BORDENA_TEST_PROFILE pause
  exit /b 1
)
echo Bordena: локальное приложение Tauri
echo Изменения собираются перед запуском. Браузер и веб-сервер не запускаются.
echo Закройте окно Bordena для завершения.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-desktop.ps1"
set "BORDENA_EXIT_CODE=%ERRORLEVEL%"
if not "%BORDENA_EXIT_CODE%"=="0" if not defined BORDENA_TEST_PROFILE pause
exit /b %BORDENA_EXIT_CODE%

