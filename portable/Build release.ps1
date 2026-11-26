param([Parameter(Mandatory)][string]$OpenCodeApp, [Parameter(Mandatory)][string]$Output)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$app = (Resolve-Path -LiteralPath $OpenCodeApp).Path
if ((Get-Item -LiteralPath (Join-Path $app 'OpenCode.exe')).VersionInfo.FileVersion -ne '2.2.5') {
    throw 'Use a versão Windows x64 2.2.5 do OpenCode Desktop.'
}
$out = [IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Path $out -Force | Out-Null
$stage = Join-Path $out 'payload'
New-Item -ItemType Directory -Path $stage | Out-Null
$target = Join-Path $stage 'apps\OpenCode'
New-Item -ItemType Directory -Path $target -Force | Out-Null
robocopy.exe $app $target /E /XJ /R:0 /W:0 /NFL /NDL /NJH /NJS /XF 'Uninstall OpenCode.exe' 'app-update.yml' 'app-update.yml.disabled' | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Falha ao copiar o aplicativo.' }
$original = Join-Path $PSScriptRoot 'app.original-2.2.5.asar'
if (-not (Test-Path -LiteralPath $original)) { $original = Join-Path $app 'resources\app.asar' }
$patched = Join-Path $out 'app.asar'
node --experimental-vm-modules (Join-Path $PSScriptRoot 'patch-desktop.cjs') $original $patched
if ($LASTEXITCODE) { throw 'Falha ao aplicar as personalizações.' }
Copy-Item -LiteralPath $patched -Destination (Join-Path $target 'resources\app.asar') -Force
Copy-Item -LiteralPath (Join-Path $root 'Abrir OpenCode.ps1') -Destination $stage
$setup = Join-Path $stage 'portable'
New-Item -ItemType Directory -Path $setup | Out-Null
foreach ($name in @('Registrar atalhos.ps1', 'Configurar leitura GitHub.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $setup
}
$cfg = Join-Path $stage 'profile\config\opencode'
New-Item -ItemType Directory -Path $cfg -Force | Out-Null
$globalConfig = [ordered]@{
    model = 'opencode/deepseek-v4.1-flash-free'
    mcp = @{ servers = @{
        context7 = @{ type='remote'; url='https://mcp.context7.com/mcp' }
        github = @{ type='remote'; url='https://api.githubcopilot.com/mcp/'; headers=@{'X-MCP-Readonly'='true'; 'X-MCP-Toolsets'='repos,issues,pull_requests,actions'} }
    } }
}
[IO.File]::WriteAllText((Join-Path $cfg 'opencode.json'), ($globalConfig | ConvertTo-Json -Depth 8))
[IO.File]::WriteAllText((Join-Path $cfg 'AGENTS.md'), 'Converse sempre com o usuário em português do Brasil (pt-BR). Preserve comandos, código e identificadores quando a precisão exigir.')
$license = Join-Path $root 'LICENSE'
if (-not (Test-Path -LiteralPath $license)) { $license = Join-Path $out 'LICENSE' }
Copy-Item -LiteralPath $license -Destination $stage
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$stub = Join-Path $out 'installer-stub.exe'
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$stub" /reference:System.Windows.Forms.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $PSScriptRoot 'Installer.cs')
if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $out 'payload.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, 'Optimal', $false)
$result = Join-Path $out 'OpenCode-Infinite-PTBR-Setup.exe'
$stream = [IO.File]::Create($result)
try {
    foreach ($file in @($stub,$zip)) {
        $source = [IO.File]::OpenRead($file)
        try { $source.CopyTo($stream) } finally { $source.Dispose() }
    }
    $footer = [BitConverter]::GetBytes([long](Get-Item -LiteralPath $stub).Length)
    $stream.Write($footer, 0, $footer.Length)
} finally { $stream.Dispose() }
(Get-FileHash -LiteralPath $result).Hash.ToLowerInvariant() + '  OpenCode-Infinite-PTBR-Setup.exe' |
    Set-Content -LiteralPath (Join-Path $out 'SHA256SUMS.txt') -Encoding ascii
