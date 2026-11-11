$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$temporaryRoot=[IO.Path]::GetFullPath((Join-Path $projectRoot '.tools'))
$names=@('_082-aw006-dst.mjs','_082-aw006-integration.mjs','_082-aw006-wheel.mjs','_082-calendar-direct.mjs','_082-calendar081-native.mjs','_082-layout08-native.mjs','_082-release081-smoke.mjs','_082-settings081-native.mjs','_082-ux08-native.mjs','_082-year081-native.mjs')
$files=@($names|ForEach-Object{ $path=[IO.Path]::GetFullPath((Join-Path $temporaryRoot $_));if(-not $path.StartsWith($temporaryRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe cleanup path'};if(Test-Path -LiteralPath $path){Get-Item -LiteralPath $path}})
if(-not $files.Count){Write-Output 'No generated regression copies remain; previous cleanup evidence retained.';exit 0}
$archivePath=Join-Path $projectRoot ('artifacts\Bordena-W1.0-cleanup-'+[DateTimeOffset]::Now.ToUnixTimeMilliseconds()+'.zip')
$manifest=@($files|ForEach-Object{@{file=$_.FullName;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower();reason='Generated transformed copy of a retained packages/e2e regression script; original retained.'}})
$zip=[IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
try{foreach($file in $files){[void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$file.Name)}}finally{$zip.Dispose()}
$zip=[IO.Compression.ZipFile]::OpenRead($archivePath)
try{foreach($row in $manifest){$entry=$zip.GetEntry([IO.Path]::GetFileName($row.file));if(-not $entry){throw 'Archive entry missing'};$stream=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create();try{$hash=[Convert]::ToHexString($sha.ComputeHash($stream)).ToLower()}finally{$stream.Dispose();$sha.Dispose()};if($hash -ne $row.sha256){throw 'Archive readback differs'}}}finally{$zip.Dispose()}
$evidence=Join-Path $projectRoot 'docs\evidence\w10-cleanup.json'
@{status='ARCHIVE_VERIFIED';archive=$archivePath;archive_sha256=(Get-FileHash -LiteralPath $archivePath).Hash.ToLower();files=$manifest}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $evidence -Encoding utf8
foreach($row in $manifest){if((Get-FileHash -LiteralPath $row.file).Hash.ToLower() -ne $row.sha256){throw 'File changed since inventory'};Remove-Item -LiteralPath $row.file}
$record=Get-Content -LiteralPath $evidence -Raw|ConvertFrom-Json;$record.status='PASS';$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $evidence -Encoding utf8
Write-Output "PASS: $($manifest.Count) generated copies archived, verified and removed. Source scripts, profiles, prior releases and licenses retained."
