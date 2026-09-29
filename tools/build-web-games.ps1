param(
    [string[]]$Ids = @(),
    [switch]$VLinkWebGPU,
    [switch]$VLinkVfxDiagnostic,
    [switch]$VLinkFurDiagnostic,
    [string]$UnityHub = 'C:\Program Files\Unity\Hub\Editor',
    [string]$CacheRoot = (Join-Path $env:TEMP 'portfolio-web-builds')
)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$CacheRoot = [IO.Path]::GetFullPath($CacheRoot)
if ($CacheRoot -match '[^\x00-\x7F]') { throw 'Use an ASCII-only build cache path for the Unity toolchain.' }
$config = Get-Content -LiteralPath (Join-Path $root 'launcher/data/game-sources.json') -Raw | ConvertFrom-Json
if ($VLinkWebGPU -and ($Ids.Count -ne 1 -or $Ids[0] -ne 'v-link-battle')) { throw 'WebGPU migration is only configured for -Ids v-link-battle.' }
if (($VLinkVfxDiagnostic -or $VLinkFurDiagnostic) -and !$VLinkWebGPU) { throw 'The diagnostics require -VLinkWebGPU.' }
if ($VLinkVfxDiagnostic -and $VLinkFurDiagnostic) { throw 'Choose one diagnostic at a time.' }
$diagnostic = $VLinkVfxDiagnostic -or $VLinkFurDiagnostic
$outputRoot = Join-Path $CacheRoot 'output'
$sourceRoot = Join-Path $CacheRoot 'sources'
$logs = Join-Path $root 'launcher/test-output'
New-Item -ItemType Directory -Force -Path $sourceRoot, $outputRoot, $logs | Out-Null
foreach ($game in $config.games) {
    if ($Ids.Count -and $game.id -notin $Ids) { continue }
    if ($game.id -notmatch '^[a-z0-9-]+$') { throw 'Invalid game id.' }
    $version = if ($VLinkWebGPU) { '6000.3.17f1' } else { $game.unity }
    $editor = Join-Path $UnityHub "$version/Editor/Unity.exe"
    $support = Join-Path $UnityHub "$version/Editor/Data/PlaybackEngines/WebGLSupport"
    if (!(Test-Path -LiteralPath $support)) { throw "Install Web Build Support for Unity $version." }
    $project = Join-Path $sourceRoot $game.id
    if (!(Test-Path -LiteralPath $project)) {
        $localSource = Join-Path $root "launcher/game-sources/$($game.id)"
        if (Test-Path -LiteralPath $localSource) {
            & git -c "safe.directory=$($localSource.Replace('\', '/'))" clone --no-hardlinks --no-checkout $localSource $project
        } else {
            & git -c http.sslBackend=openssl clone --no-checkout $game.repository $project
        }
        if ($LASTEXITCODE) { throw "Clone failed: $($game.id)" }
        & git -C $project checkout --detach $game.commit
        if ($LASTEXITCODE) { throw "Checkout failed: $($game.id)" }
    }
    $commit = & git -C $project rev-parse HEAD
    if ($LASTEXITCODE -or $commit -ne $game.commit) { throw "Unexpected source commit: $project" }
    $projectVersionFile = Join-Path $project 'ProjectSettings/ProjectVersion.txt'
    $projectVersion = Get-Content -LiteralPath $projectVersionFile -Raw
    if ($game.id -eq 'v-link-battle' -and !$VLinkWebGPU -and $projectVersion -match 'm_EditorVersion: 6000\.') {
        throw 'This V-Link workspace has been migrated to Unity 6. Use -VLinkWebGPU; do not downgrade it in place.'
    }
    if ($game.id -eq 'v-link-battle') {
        $adaptationArgs = @((Join-Path $PSScriptRoot 'prepare-vlink-web.cjs'), $project)
        if ($VLinkWebGPU) { $adaptationArgs += @('--webgpu', "--unity-editor=$editor") }
        if ($VLinkWebGPU -and $projectVersion -notmatch 'm_EditorVersion: 6000\.3\.17f1') {
            & node @adaptationArgs --prepare-upgrade
            if ($LASTEXITCODE) { throw 'V-Link upgrade preparation failed.' }
            # The fur editor adapter references these types during the first compilation.
            $bootstrapEditor = Join-Path $project 'Assets/Editor'
            New-Item -ItemType Directory -Force -Path $bootstrapEditor | Out-Null
            Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'unity') -Filter '*.cs' | Copy-Item -Destination $bootstrapEditor
            $upgradeLog = Join-Path $logs 'vlink-unity6-upgrade.log'
            $upgradeArgs = @('-batchmode', '-quit', '-accept-apiupdate', '-projectPath', ('"' + $project + '"'), '-buildTarget', 'WebGL', '-logFile', ('"' + $upgradeLog + '"'), '-job-worker-count', '8')
            $upgrade = Start-Process -FilePath $editor -ArgumentList $upgradeArgs -WindowStyle Hidden -PassThru
            $upgrade.WaitForExit()
            if ($upgrade.ExitCode -ne 0) { throw "Unity 6 initial import failed: $upgradeLog" }
        }
        & node @adaptationArgs
        if ($LASTEXITCODE) { throw 'V-Link Web adaptation failed.' }
    } elseif (& git -C $project diff --name-only HEAD -- Assets Packages) { throw "Review source changes before building: $project" }
    $editorFolder = Join-Path $project 'Assets/Editor'
    New-Item -ItemType Directory -Force -Path $editorFolder | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'unity') -Filter '*.cs' | Copy-Item -Destination $editorFolder
    if ($diagnostic) {
        $diagnostics = Join-Path $project 'Assets/PortfolioDiagnostics'
        New-Item -ItemType Directory -Force -Path $diagnostics | Out-Null
        foreach ($file in @('PortfolioVfxDiagnostic.cs', 'VfxReferenceBlit.shader')) {
            Copy-Item -LiteralPath (Join-Path $PSScriptRoot "vlink-web/$file") -Destination $diagnostics
        }
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vlink-web/PortfolioVfxDiagnosticBuild.cs') -Destination $editorFolder
    }
    $outputId = if ($VLinkFurDiagnostic) { "$($game.id)-fur-check" } elseif ($VLinkVfxDiagnostic) { "$($game.id)-vfx-check" } else { $game.id }
    $output = Join-Path $outputRoot $outputId
    $logName = if ($VLinkFurDiagnostic) { 'vlink-fur-diagnostic-build.log' } elseif ($VLinkVfxDiagnostic) { 'vlink-vfx-diagnostic-build.log' } else { "$($game.id)-web-build.log" }
    $log = Join-Path $logs $logName
    $env:PORTFOLIO_WEB_OUTPUT = $output
    $env:PORTFOLIO_VFX_DIAGNOSTIC_OUTPUT = if ($VLinkVfxDiagnostic) { $output } else { '' }
    $env:PORTFOLIO_FUR_DIAGNOSTIC_OUTPUT = if ($VLinkFurDiagnostic) { $output } else { '' }
    $env:PORTFOLIO_WEB_SIMPLE_EFFECTS = if (!$VLinkWebGPU -and $game.id -in @('teruteru-wars', 'futago', 'v-link-battle')) { '1' } else { '0' }
    $env:PORTFOLIO_WEBGPU = if ($VLinkWebGPU) { '1' } else { '0' }
    $env:PORTFOLIO_WEB_VLINK = if ($game.id -eq 'v-link-battle' -and !$diagnostic) { '1' } else { '0' }
    $buildFolder = [IO.Path]::GetFullPath((Join-Path $output 'Build'))
    $expectedFolder = [IO.Path]::GetFullPath((Join-Path $outputRoot "$outputId/Build"))
    if ($buildFolder -ne $expectedFolder -or !$buildFolder.StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe build output path.' }
    if (Test-Path -LiteralPath $buildFolder) { Remove-Item -LiteralPath $buildFolder -Recurse -Force }
    $metadataName = if ($diagnostic) { 'unity-version.txt' } else { 'portfolio-build.json' }
    $metadata = Join-Path $output $metadataName
    if (Test-Path -LiteralPath $metadata) { Remove-Item -LiteralPath $metadata }
    $method = if ($VLinkFurDiagnostic) { 'PortfolioFurReference.BuildWeb' } elseif ($VLinkVfxDiagnostic) { 'PortfolioVfxDiagnosticBuild.Build' } else { 'PortfolioWebBuild.Build' }
    $arguments = @('-batchmode', '-quit', '-accept-apiupdate', '-projectPath', ('"' + $project + '"'), '-buildTarget', 'WebGL', '-executeMethod', $method, '-logFile', ('"' + $log + '"'))
    if ($VLinkWebGPU) { $arguments += @('-job-worker-count', '8') }
    Write-Host "Building Web: $($game.id) with Unity $version (WebGPU=$VLinkWebGPU)"
    $process = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or !(Test-Path -LiteralPath $metadata)) {
        throw "Web build failed ($($process.ExitCode)): $log"
    }
    if ($VLinkWebGPU) {
        $buildLog = Get-Content -LiteralPath $log -Raw
        $prepared = $buildLog.LastIndexOf('PORTFOLIO_LILTOON_REGENERATED:')
        if ($prepared -ge 0) { $buildLog = $buildLog.Substring($prepared) }
        if ($buildLog -match '(?m)^Shader error') {
            Remove-Item -LiteralPath $metadata
            throw "WebGPU shaders failed even though Unity produced a player. See $log"
        }
    }
    Write-Host "Web build ready: $output"
}
