$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$env:BORDENA_TEST_PROFILE = Join-Path $projectRoot ('.tools\qa-launcher-aw006-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9231'
$originalPath = $env:PATH
$env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User')
$launcher = Start-Process -FilePath cmd.exe -ArgumentList @('/d','/c',"$projectRoot\dev.bat") -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'docs\evidence\aw006-dev-bat.log') -RedirectStandardError (Join-Path $projectRoot 'docs\evidence\aw006-dev-bat-errors.log')
$launcherHandle = $launcher.Handle
$env:PATH = $originalPath
try {
    & .\.tools\bin\pnpm.cmd --filter '@bordena/e2e' exec node aw003-launcher.mjs
    $testExit = $LASTEXITCODE
} finally {
    if (-not $launcher.WaitForExit(15000)) {
        & taskkill /PID $launcher.Id /T /F | Out-Null
        $testExit = 1
    }
}
$launcher.Refresh()
if ($null -eq $launcher.ExitCode -or $launcher.ExitCode -ne 0) { $testExit = 1 }
Write-Host ('dev.bat exit code: ' + $launcher.ExitCode)
exit $testExit
