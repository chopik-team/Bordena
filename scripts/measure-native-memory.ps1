param([Parameter(Mandatory=$true)][string]$Profile)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$qaPrefix=[IO.Path]::GetFullPath((Join-Path $projectRoot '.tools\qa-'))
$resolvedProfile=[IO.Path]::GetFullPath($Profile)
if(-not $resolvedProfile.StartsWith($qaPrefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Only QA profiles can be measured'}
$processes=@(Get-CimInstance Win32_Process)
$byId=@{}
foreach($processInfo in $processes){$byId[[int]$processInfo.ProcessId]=$processInfo}
$rootIds=[Collections.Generic.HashSet[int]]::new()
foreach($processInfo in $processes){
 if(-not $processInfo.CommandLine -or -not $processInfo.CommandLine.Contains($resolvedProfile)){continue}
 $ancestor=$processInfo
 for($depth=0;$depth -lt 12 -and $ancestor;$depth++){
  if($ancestor.Name -eq 'bordena.exe'){[void]$rootIds.Add([int]$ancestor.ProcessId);break}
  $ancestor=$byId[[int]$ancestor.ParentProcessId]
 }
}
if($rootIds.Count -eq 0){throw 'Native process for the QA profile was not found'}
$measured=@($processes|Where-Object {
 $ancestor=$_
 for($depth=0;$depth -lt 12 -and $ancestor;$depth++){
  if($rootIds.Contains([int]$ancestor.ProcessId)){return $true}
  $ancestor=$byId[[int]$ancestor.ParentProcessId]
 }
 return $false
})
@{workingSetBytes=[long](($measured|Measure-Object -Property WorkingSetSize -Sum).Sum);processCount=$measured.Count;method='WorkingSetSize summed for verified QA Bordena process and descendants; shared pages can be counted more than once'}|ConvertTo-Json -Compress
