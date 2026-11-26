param(
    [Parameter(Mandatory)][string]$OpenCodeApp,
    [Parameter(Mandatory)][string]$Output,
    [switch]$PreparedApp,
    [switch]$EnableHeadroom
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $PSScriptRoot 'verify-upstream.cjs')
if ($LASTEXITCODE) { throw 'Compatibilidade com o atualizador oficial não confirmada.' }
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
if ($PreparedApp) {
    # Repackage the already personalised application without applying patches twice.
    & node (Join-Path $PSScriptRoot 'verify-prepared-app.cjs') (Join-Path $app 'resources\app.asar')
    if ($LASTEXITCODE) { throw 'O aplicativo informado não tem as personalizações esperadas.' }
    $personalized = Join-Path $app 'resources\app.asar'
} else {
    $personalized = Join-Path $out 'app.personalized.asar'
    node --no-warnings --experimental-vm-modules (Join-Path $PSScriptRoot 'patch-desktop.cjs') $original $personalized
    if ($LASTEXITCODE) { throw 'Falha ao aplicar as personalizações.' }
}
& node --no-warnings --experimental-vm-modules (Join-Path $PSScriptRoot 'patch-service-state.cjs') $personalized $patched
if ($LASTEXITCODE) { throw 'Falha ao corrigir o isolamento do serviço portátil.' }
Copy-Item -LiteralPath $patched -Destination (Join-Path $target 'resources\app.asar') -Force
Copy-Item -LiteralPath (Join-Path $root 'Abrir OpenCode.ps1') -Destination $stage
$setup = Join-Path $stage 'portable'
New-Item -ItemType Directory -Path $setup | Out-Null
foreach ($name in @('Configurar leitura GitHub.ps1', 'Configurar Headroom.ps1', 'Start-Headroom.ps1', 'Launch-WithHeadroom.ps1', 'headroom-runtime.py', 'headroom-requirements.txt')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $setup
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Registrar atalhos.Headroom.ps1') -Destination (Join-Path $setup 'Registrar atalhos.ps1')
if ($EnableHeadroom) {
    $headroomSettings = Join-Path $stage 'profile\headroom'
    New-Item -ItemType Directory -Force -Path $headroomSettings | Out-Null
    [IO.File]::WriteAllText((Join-Path $headroomSettings 'settings.json'), '{"enabled":true,"port":18787,"installOnFirstRun":true}')
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
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/win32manifest:$(Join-Path $PSScriptRoot 'windows.manifest')" "/out:$(Join-Path $stage 'OpenCode Infinite PT-BR.exe')" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE) { throw 'Falha ao compilar o launcher.' }
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/win32manifest:$(Join-Path $PSScriptRoot 'windows.manifest')" "/out:$stub" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $PSScriptRoot 'Installer.Headroom.cs') (Join-Path $PSScriptRoot 'UpdateExisting.Headroom.cs')
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
$hash = (& node -e "const c=require('crypto'),fs=require('fs');process.stdout.write(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" $result).Trim()
($hash + '  OpenCode-Infinite-PTBR-Setup.exe') |
    Set-Content -LiteralPath (Join-Path $out 'SHA256SUMS.txt') -Encoding ascii
