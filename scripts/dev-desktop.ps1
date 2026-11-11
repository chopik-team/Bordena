$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\native-env.ps1"
Set-Location (Split-Path $PSScriptRoot -Parent)
& powershell -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\check-environment.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$applicationPath = Join-Path (Get-Location) 'apps/desktop/src-tauri/target/debug/bordena.exe'
if (Get-Process bordena -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $applicationPath }) {
    Write-Host 'Закройте Bordena перед повторной сборкой. Данные сохранятся.'
    exit 1
}
$env:NO_UPDATE_NOTIFIER = '1'
$env:PNPM_DISABLE_SELF_UPDATE_CHECK = '1'
# Rebuild the embedded frontend on every run. The launched app needs no Vite server.
& pnpm --filter desktop build --debug --no-bundle
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& '.\apps\desktop\src-tauri\target\debug\bordena.exe'
exit $LASTEXITCODE
