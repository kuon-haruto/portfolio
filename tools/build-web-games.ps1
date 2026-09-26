param(
    [string[]]$Ids = @(),
    [string]$UnityHub = 'C:\Program Files\Unity\Hub\Editor',
    [string]$CacheRoot = (Join-Path $env:TEMP 'portfolio-web-builds')
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$CacheRoot = [IO.Path]::GetFullPath($CacheRoot)
if ($CacheRoot -match '[^\x00-\x7F]') { throw 'Use an ASCII-only build cache path for the Unity toolchain.' }
$config = Get-Content -LiteralPath (Join-Path $root 'launcher/data/game-sources.json') -Raw | ConvertFrom-Json
$outputRoot = Join-Path $CacheRoot 'output'
$sourceRoot = Join-Path $CacheRoot 'sources'
$logs = Join-Path $root 'launcher/test-output'
New-Item -ItemType Directory -Force -Path $sourceRoot, $outputRoot, $logs | Out-Null
foreach ($game in $config.games) {
    if ($Ids.Count -and $game.id -notin $Ids) { continue }
    if ($game.id -notmatch '^[a-z0-9-]+$') { throw 'Invalid game id.' }
    $editor = Join-Path $UnityHub "$($game.unity)/Editor/Unity.exe"
    $support = Join-Path $UnityHub "$($game.unity)/Editor/Data/PlaybackEngines/WebGLSupport"
    if (!(Test-Path -LiteralPath $support)) { throw "Install Web Build Support for Unity $($game.unity)." }
    $project = Join-Path $sourceRoot $game.id
    if (!(Test-Path -LiteralPath $project)) {
        $localSource = Join-Path $root "launcher/game-sources/$($game.id)"
        & git -c "safe.directory=$($localSource.Replace('\', '/'))" clone --no-hardlinks --no-checkout $localSource $project
        if ($LASTEXITCODE) { throw "Clone failed: $($game.id)" }
        & git -C $project checkout --detach $game.commit
        if ($LASTEXITCODE) { throw "Checkout failed: $($game.id)" }
    }
    $commit = & git -C $project rev-parse HEAD
    if ($LASTEXITCODE -or $commit -ne $game.commit) { throw "Unexpected source commit: $project" }
    if (& git -C $project diff --name-only HEAD -- Assets Packages) { throw "Review source changes before building: $project" }
    $editorFolder = Join-Path $project 'Assets/Editor'
    New-Item -ItemType Directory -Force -Path $editorFolder | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'unity') -Filter '*.cs' | Copy-Item -Destination $editorFolder
    $output = Join-Path $outputRoot $game.id
    $log = Join-Path $logs "$($game.id)-web-build.log"
    $env:PORTFOLIO_WEB_OUTPUT = $output
    $env:PORTFOLIO_WEB_SIMPLE_EFFECTS = if ($game.id -in @('teruteru-wars', 'futago')) { '1' } else { '0' }
    $buildFolder = [IO.Path]::GetFullPath((Join-Path $output 'Build'))
    $expectedFolder = [IO.Path]::GetFullPath((Join-Path $outputRoot "$($game.id)/Build"))
    if ($buildFolder -ne $expectedFolder -or !$buildFolder.StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe build output path.' }
    if (Test-Path -LiteralPath $buildFolder) { Remove-Item -LiteralPath $buildFolder -Recurse -Force }
    $metadata = Join-Path $output 'portfolio-build.json'
    if (Test-Path -LiteralPath $metadata) { Remove-Item -LiteralPath $metadata }
    $arguments = @('-batchmode', '-quit', '-projectPath', ('"' + $project + '"'), '-buildTarget', 'WebGL', '-executeMethod', 'PortfolioWebBuild.Build', '-logFile', ('"' + $log + '"'))
    Write-Host "Building Web: $($game.id) with Unity $($game.unity)"
    $process = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath (Join-Path $output 'portfolio-build.json'))) {
        throw "Web build failed ($($process.ExitCode)): $log"
    }
    Write-Host "Web build ready: $output"
}
