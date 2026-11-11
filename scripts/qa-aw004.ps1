$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\native-env.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
$env:BORDENA_TEST_PROFILE = Join-Path $projectRoot ('.tools\qa-aw004-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9232'
$hostScript = Join-Path $projectRoot '.tools\qa-aw004-host.ps1'
[IO.File]::WriteAllText($hostScript, ('Set-Location -LiteralPath ''{0}''{1}& ''{0}\.tools\bin\pnpm.cmd'' --filter desktop dev{1}exit $LASTEXITCODE' -f $projectRoot, [Environment]::NewLine), [Text.UTF8Encoding]::new($true))
$hostProcess = Start-Process -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$hostScript) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'docs\evidence\aw004-native-host.log') -RedirectStandardError (Join-Path $projectRoot 'docs\evidence\aw004-native-host-errors.log')
try {
    & .\.tools\bin\pnpm.cmd --filter '@bordena/e2e' exec node aw004-native.mjs
    $testExit = $LASTEXITCODE
} finally {
    if (-not $hostProcess.WaitForExit(15000)) {
        # Only the process tree created above belongs to this isolated QA run.
        & taskkill /PID $hostProcess.Id /T /F | Out-Null
    }
}
exit $testExit
