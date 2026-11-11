# Portable tools stay inside the project. A normal VS Developer shell also works.
$projectRoot = Split-Path $PSScriptRoot -Parent
$portableRoot = Join-Path $projectRoot '.tools'
$env:CARGO_NET_OFFLINE = 'true'
if (Test-Path "$portableRoot\cargo\bin\cargo.exe") {
    $env:RUSTUP_HOME = "$portableRoot\rustup"
    $env:CARGO_HOME = "$portableRoot\cargo"
    $env:PATH = "$portableRoot\cargo\bin;$env:PATH"
}
$vcRoot = "$portableRoot\msvc\Contents\VC\Tools\MSVC\14.44.35207"
$sdkRoot = "$portableRoot\microsoft.windows.sdk.cpp\c"
$sdkLib = "$portableRoot\microsoft.windows.sdk.cpp.x64\c"
if (Test-Path "$vcRoot\bin\Hostx64\x64\link.exe") {
    $env:VCToolsInstallDir = "$vcRoot\"
    $env:VSINSTALLDIR = "$portableRoot\msvc\Contents\"
    $env:VCINSTALLDIR = "$portableRoot\msvc\Contents\VC\"
    $env:WindowsSdkDir = "$sdkRoot\"
    $env:WindowsSDKVersion = '10.0.26100.0\'
    $env:PATH = "$vcRoot\bin\Hostx64\x64;$sdkRoot\bin\10.0.26100.0\x64;$env:PATH"
    $env:LIB = "$vcRoot\lib\x64;$sdkLib\um\x64;$sdkLib\ucrt\x64"
    $env:INCLUDE = "$vcRoot\include;$sdkRoot\Include\10.0.26100.0\ucrt;$sdkRoot\Include\10.0.26100.0\um;$sdkRoot\Include\10.0.26100.0\shared"
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = "$vcRoot\bin\Hostx64\x64\link.exe"
}
