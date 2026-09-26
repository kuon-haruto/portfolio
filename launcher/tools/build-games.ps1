param(
    [string[]]$Ids = @(),
    [string]$UnityHub = 'C:\Program Files\Unity\Hub\Editor',
    [string]$SourceRoot = '',
    [switch]$OpenSsl
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!$SourceRoot) { $SourceRoot = Join-Path $root 'game-sources' }
$SourceRoot = [IO.Path]::GetFullPath($SourceRoot)
$config = Get-Content -LiteralPath (Join-Path $root 'data/game-sources.json') -Raw | ConvertFrom-Json
$gitOptions = @()
if ($OpenSsl) { $gitOptions = @('-c', 'http.sslBackend=openssl') }
foreach ($game in $config.games) {
    if ($Ids.Count -and $game.id -notin $Ids) { continue }
    $project = Join-Path $SourceRoot $game.id
    $output = Join-Path $root "game-builds/$($game.id)"
    $log = Join-Path $root "test-output/$($game.id)-build.log"
    $editor = Join-Path $UnityHub "$($game.unity)/Editor/Unity.exe"
    if (!(Test-Path -LiteralPath $editor)) { throw "Install Unity $($game.unity) with Windows build support: $editor" }
    if (!(Test-Path -LiteralPath $project)) {
        & git @gitOptions clone --no-checkout $game.repository $project
        if ($LASTEXITCODE) { throw "Clone failed: $($game.id)" }
        & git -C $project checkout --detach $game.commit
        if ($LASTEXITCODE) { throw "Checkout failed: $($game.id)" }
    }
    $commit = & git -c "safe.directory=$($project.Replace('\', '/'))" -C $project rev-parse HEAD
    if ($LASTEXITCODE -or $commit -ne $game.commit) { throw "Source commit differs from data/game-sources.json: $($game.id)" }
    if ((& git -c "safe.directory=$($project.Replace('\', '/'))" -C $project diff --name-only HEAD -- Assets Packages ProjectSettings)) {
        throw "Source has local edits; use a clean clone or review and commit them: $project"
    }
    New-Item -ItemType Directory -Force -Path $output, (Split-Path $log -Parent) | Out-Null
    $arguments = @('-batchmode', '-quit', '-projectPath', ('"' + $project + '"'), '-buildTarget', 'win64', '-buildWindows64Player', ('"' + (Join-Path $output $game.executable) + '"'), '-logFile', ('"' + $log + '"'))
    Write-Host "Building $($game.id) with Unity $($game.unity)"
    $process = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath (Join-Path $output $game.executable))) {
        throw "Unity build failed ($($process.ExitCode)); see $log"
    }
    Write-Host "Built: $output"
}
