[CmdletBinding()]
param([switch]$Disable, [ValidateRange(1024, 65535)][int]$Port = 8787)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root 'profile\headroom'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$settings = Join-Path $runtime 'settings.json'
if ($Disable) {
    [IO.File]::WriteAllText($settings, '{"enabled":false}')
    Write-Host 'Headroom desativado. Feche e abra o OpenCode para aplicar.'
    return
}
if (-not $PSBoundParameters.ContainsKey('Port')) {
    # Keep the configured port on upgrades, otherwise find a free loopback port.
    if (Test-Path -LiteralPath $settings) {
        $saved = Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
        if ($saved.port) { $Port = [int]$saved.port }
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
        try { $listener.Start(); break } catch { $Port++ } finally { $listener.Stop() }
    }
}
$python = Join-Path $runtime 'venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    & python -m venv (Join-Path $runtime 'venv')
    if ($LASTEXITCODE) { throw 'Instale Python 3.11 ou superior para usar o Headroom.' }
}
& $python -c "import sys; from importlib.metadata import distributions; sys.exit(0 if any(d.metadata['Name'] == 'headroom-ai' and d.version == '0.45.0' for d in distributions()) else 1)"
if ($LASTEXITCODE) {
    & $python -m pip install --disable-pip-version-check -r (Join-Path $PSScriptRoot 'headroom-requirements.txt')
    if ($LASTEXITCODE) { throw 'Falha ao instalar o Headroom; a integração não foi ativada.' }
}
& $python -c 'from headroom.providers.opencode.runtime import headroom_opencode_plugin_path; assert headroom_opencode_plugin_path()'
if ($LASTEXITCODE) { throw 'O plugin oficial do Headroom não está disponível.' }
& $python -c "import os,sys,tiktoken; os.environ['TIKTOKEN_CACHE_DIR']=os.path.join(sys.argv[1],'cache','tiktoken'); tiktoken.get_encoding('cl100k_base'); tiktoken.get_encoding('o200k_base')" $runtime
if ($LASTEXITCODE) { throw 'Falha ao preparar os tokenizadores locais do Headroom.' }
[IO.File]::WriteAllText($settings, (@{ enabled = $true; port = $Port } | ConvertTo-Json))
Write-Host "Headroom ativado na porta $Port. Feche e abra o OpenCode pelo Abrir OpenCode.ps1."
