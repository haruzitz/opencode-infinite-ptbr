# Starts an isolated desktop profile and closes only this test's processes.
param([string]$AppPath)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $AppPath) { $AppPath = Join-Path $root 'apps\OpenCode' }
$AppPath = (Resolve-Path -LiteralPath $AppPath).Path
$case = Join-Path $root ('downloads\desktop-startup-proof-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $case | Out-Null
$env:OPENCODE_DESKTOP_TEST_ROOT = $case
$env:OPENCODE_DISABLE_MODELS_FETCH = '1'
foreach ($kind in @('CONFIG', 'DATA', 'STATE', 'CACHE')) {
    $folder = Join-Path $case $kind.ToLower()
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    [Environment]::SetEnvironmentVariable(('XDG_' + $kind + '_HOME'), $folder, 'Process')
}
$env:USERPROFILE = Join-Path $case 'home'
$env:XDG_STATE_HOME = Join-Path $case 'home\.local\state'
New-Item -ItemType Directory -Force -Path $env:XDG_STATE_HOME | Out-Null
$cli = Join-Path $AppPath 'resources\opencode-cli.exe'
. (Join-Path $root 'portable\Initialize-Service.ps1')
. (Join-Path $root 'portable\Start-Headroom.ps1')
Start-PortableHeadroom -Root $root
$port = Initialize-PortableService -Cli $cli
$process = $null
$ready = $false
try {
    $process = Start-Process -FilePath (Join-Path $AppPath 'OpenCode.exe') -ArgumentList '--lang=pt-BR' -WorkingDirectory $case -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        Start-Sleep -Milliseconds 500
        $logs = @(Get-ChildItem (Join-Path $case 'desktop\logs') -Filter main.log -Recurse -ErrorAction SilentlyContinue)
        foreach ($log in $logs) {
            $text = Get-Content -LiteralPath $log.FullName -Raw
            if ($text -match 'v2 CLI background service failed') { throw "Desktop não iniciou o serviço. Logs: $case" }
            if ($text -match 'v2 CLI background service ready') { $ready = $true }
        }
    } until ($ready -or $process.HasExited -or [DateTime]::UtcNow -gt $deadline)
    if (-not $ready) { throw "Desktop não ficou pronto. Logs: $case" }
    $metadata = Get-Content -LiteralPath (Join-Path $env:XDG_STATE_HOME 'opencode\service.json') -Raw | ConvertFrom-Json
    if (([Uri]$metadata.url).Port -ne $port) { throw 'Desktop não usou a porta do perfil.' }
    Write-Host "PASS: Desktop e serviço real prontos com Headroom, porta $port. Logs: $case"
} finally {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
    & $cli service stop *> $null
}
