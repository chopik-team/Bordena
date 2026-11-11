$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\native-env.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
New-Item -ItemType Directory -Path '.tools','docs/evidence','docs/licenses/mpl-sources' -Force | Out-Null
& cargo metadata --offline --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --format-version 1 --filter-platform x86_64-pc-windows-msvc > .tools/cargo-metadata.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$metadata = Get-Content .tools/cargo-metadata.json -Raw | ConvertFrom-Json
$nodeMap = @{}
foreach ($node in $metadata.resolve.nodes) { $nodeMap[$node.id] = $node }
$queue = [Collections.Generic.Queue[string]]::new()
$queue.Enqueue($metadata.resolve.root)
$used = [Collections.Generic.HashSet[string]]::new()
while ($queue.Count) {
    $key = $queue.Dequeue()
    if ($used.Add($key)) { foreach ($dep in $nodeMap[$key].deps) { $queue.Enqueue($dep.pkg) } }
}
$packages = $metadata.packages | Where-Object { $used.Contains($_.id) }
$packages | Select-Object name,version,license,repository | ConvertTo-Json -Depth 5 |
    Set-Content docs/evidence/rust-packages.json -Encoding utf8
$notices = [Text.StringBuilder]::new()
$packageVersion = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
[void]$notices.AppendLine("Bordena $packageVersion - Rust dependencies (including build dependencies, Windows x64 graph)")
foreach ($package in $packages | Sort-Object name) {
    [void]$notices.AppendLine("`n========================================`n$($package.name) $($package.version) - $($package.license)")
    $packageRoot = Split-Path $package.manifest_path -Parent
    foreach ($licenseFile in Get-ChildItem -LiteralPath $packageRoot -File | Where-Object Name -Match '^(LICEN[SC]E|COPYING|NOTICE)(\.|$|-)') {
        [void]$notices.AppendLine($licenseFile.Name)
        [void]$notices.AppendLine([IO.File]::ReadAllText($licenseFile.FullName))
    }
    if ($package.license -eq 'MPL-2.0') {
        $destination = Join-Path $projectRoot "docs/licenses/mpl-sources/$($package.name)-$($package.version)"
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Get-ChildItem -LiteralPath $packageRoot -Force | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
        }
    }
}
[IO.File]::WriteAllText((Join-Path $projectRoot 'docs/RUST_THIRD_PARTY_NOTICES.txt'), $notices.ToString(), [Text.UTF8Encoding]::new($false))
