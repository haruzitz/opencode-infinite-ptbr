$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$case = Join-Path $root ('downloads\service-port-proof-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $case | Out-Null
$cli = Join-Path $root 'apps\OpenCode\resources\opencode-cli.exe'
foreach ($kind in @('CONFIG', 'DATA', 'STATE', 'CACHE')) {
    $folder = Join-Path $case $kind.ToLower()
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    [Environment]::SetEnvironmentVariable(('XDG_' + $kind + '_HOME'), $folder, 'Process')
}
$blocker = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 28894)
$ownsBlocker = $false
try {
    try { $blocker.Start(); $ownsBlocker = $true } catch { }
    . (Join-Path $root 'portable\Initialize-Service.ps1')
    $port = Initialize-PortableService -Cli $cli
    if ($port -eq 28894) { throw 'O serviço tentou reutilizar a porta padrão ocupada.' }
    & $cli service start *> (Join-Path $case 'service-start.log')
    if ($LASTEXITCODE -ne 0) { throw "O serviço não iniciou. Logs: $case" }
    $metadata = Get-Content -LiteralPath (Join-Path $case 'state\opencode\service.json') -Raw | ConvertFrom-Json
    $uri = [Uri]$metadata.url
    if ($uri.Port -ne $port) { throw 'O serviço não utilizou a porta configurada.' }
    if ($ownsBlocker -and -not $blocker.Server.IsBound) { throw 'A porta ocupada foi interrompida.' }
    Write-Host "PASS: serviço real iniciou na porta $port com 28894 ocupada."
} finally {
    & $cli service stop *> $null
    $blocker.Stop()
}
