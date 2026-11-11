@echo off
setlocal
chcp 65001 >nul
set "BORDENA_EXE=%~dp0artifacts\Bordena-W1.0-Windows-x64\Bordena.exe"
if not exist "%BORDENA_EXE%" (
  echo Не найден Bordena W 1.0: "%BORDENA_EXE%"
  echo Восстановите комплект приложения. Для разработки отдельно запустите dev.bat.
  exit /b 2
)
start "" /D "%~dp0" "%BORDENA_EXE%" %*
exit /b %ERRORLEVEL%
