$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\native-env.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
$packageVersion = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
foreach ($manifest in @('apps/client/package.json','apps/desktop/package.json')) {
    if ((Get-Content (Join-Path $projectRoot $manifest) -Raw | ConvertFrom-Json).version -ne $packageVersion) {
        Write-Host ('Версия не совпадает с package.json: ' + $manifest) -ForegroundColor Red
        exit 1
    }
}
$cargoManifest = Get-Content (Join-Path $projectRoot 'apps/desktop/src-tauri/Cargo.toml') -Raw
if ($cargoManifest -notmatch ('(?m)^version = "' + [regex]::Escape($packageVersion) + '"\r?$')) {
    Write-Host 'Версия Cargo.toml не совпадает с package.json.' -ForegroundColor Red
    exit 1
}
$missing = @()
foreach ($tool in @('node', 'pnpm', 'cargo', 'rustc', 'cl.exe', 'link.exe', 'rc.exe')) {
    $command = Get-Command $tool -ErrorAction SilentlyContinue
    if (-not $command) { $missing += $tool }
}
if ($missing.Count -gt 0) {
    Write-Host ('Не найдены инструменты Bordena: ' + ($missing -join ', ')) -ForegroundColor Red
    Write-Host 'Проверьте .tools и docs/WINDOWS_INSTALL.md. Автоматическая загрузка не выполняется.'
    exit 1
}
Write-Host 'Среда Bordena готова: Node, pnpm, Rust MSVC, C++ и Windows SDK.'
& node --version
& pnpm --version
& rustc --version
