param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = (Resolve-Path (Join-Path $root 'games/bug-hunter')).Path
$link = Join-Path $env:TEMP 'bug-hunter-unity'
if (Test-Path -LiteralPath $link) {
    $existing = Get-Item -LiteralPath $link
    if ($existing.LinkType -ne 'Junction' -or $existing.Target -ne $source) {
        throw 'The temporary Unity path is owned by another folder.'
    }
} else {
    New-Item -ItemType Junction -Path $link -Target $source | Out-Null
}
$env:BUG_HUNTER_BUILD = Join-Path $env:TEMP 'bug-hunter-web'
$log = Join-Path $env:TEMP 'bug-hunter-build.log'
$method = if ($ValidateOnly) { 'BuildGame.Validate' } else { 'BuildGame.Web' }
$arguments = @('-batchmode', '-nographics', '-quit', '-projectPath', "`"$link`"", '-buildTarget', 'WebGL', '-executeMethod', $method, '-logFile', "`"$log`"")
$process = Start-Process -FilePath 'C:/Program Files/Unity/Hub/Editor/6000.0.54f1/Editor/Unity.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden
Write-Output "Unity PID $($process.Id). Log: $log"
$process.WaitForExit()
Get-Content -LiteralPath $log -Tail 35
if ($process.ExitCode -ne 0) { throw "Unity failed with exit code $($process.ExitCode)." }
if (-not $ValidateOnly) {
    & node (Join-Path $PSScriptRoot 'prepare-bug-hunter.cjs') $env:BUG_HUNTER_BUILD
    if ($LASTEXITCODE -ne 0) { throw 'Web packaging failed.' }
}
