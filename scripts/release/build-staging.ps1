param([Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $projectRoot
. ./scripts/native-env.ps1
$env:PATH="$projectRoot\.tools\node;$projectRoot\.tools\bin;$env:PATH"
$env:NO_UPDATE_NOTIFIER='1';$env:PNPM_DISABLE_SELF_UPDATE_CHECK='1'
$stagingRoot=Join-Path $projectRoot ".tools\qa-w10-build-$Version"
New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
$overlay=Join-Path $stagingRoot 'tauri.json'
$config=@{productName='Bordena W10 QA';identifier='team.chopik.bordena.release-qa';version=$Version}
[IO.File]::WriteAllText($overlay,($config|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
$oldStaging=$env:BORDENA_STAGING;$oldVersion=$env:BORDENA_BUILD_VERSION
try {
  $env:BORDENA_STAGING='1';$env:BORDENA_BUILD_VERSION=$Version
  Push-Location apps/desktop
  try {
    if ($Version -eq '0.8.2') {
      Copy-Item -LiteralPath (Join-Path $projectRoot 'artifacts\Bordena-0.8.2-Windows-x64\Bordena.exe') -Destination (Join-Path $projectRoot 'apps\desktop\src-tauri\target\release\bordena.exe')
      & pnpm exec tauri bundle --bundles nsis --no-binary-patching --config $overlay
    } else { & pnpm exec tauri build --bundles nsis --config $overlay }
    $buildExit=$LASTEXITCODE
  } finally {Pop-Location}
  if($buildExit -ne 0){throw 'Staging build failed'}
  $installer=Join-Path $projectRoot "apps\desktop\src-tauri\target\release\bundle\nsis\Bordena W10 QA_${Version}_x64-setup.exe"
  & node scripts/release/package.mjs --staging "--version=$Version" "--output=.tools/qa-w10-package-$Version" "--installer=$installer"
  if($LASTEXITCODE -ne 0){throw 'Staging package failed'}
} finally {$env:BORDENA_STAGING=$oldStaging;$env:BORDENA_BUILD_VERSION=$oldVersion}
