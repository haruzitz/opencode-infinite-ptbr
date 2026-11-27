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
node --no-warnings --experimental-vm-modules (Join-Path $PSScriptRoot 'patch-desktop.cjs') $original $patched
if ($LASTEXITCODE) { throw 'Falha ao aplicar as personalizações.' }
Copy-Item -LiteralPath $patched -Destination (Join-Path $target 'resources\app.asar') -Force
Copy-Item -LiteralPath (Join-Path $root 'Abrir OpenCode.ps1') -Destination $stage
$setup = Join-Path $stage 'portable'
New-Item -ItemType Directory -Path $setup | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Registrar atalhos.ps1') -Destination $setup
$desktopHelpers = Join-Path $target 'resources\portable'
New-Item -ItemType Directory -Path $desktopHelpers -Force | Out-Null
foreach ($name in @('Configurar leitura GitHub.ps1')) {
    [IO.File]::WriteAllText((Join-Path $desktopHelpers $name), [IO.File]::ReadAllText((Join-Path $PSScriptRoot $name)),
        [Text.UTF8Encoding]::new($true))
}
$githubDir = Join-Path $target 'resources\github-mcp'
$githubZip = Join-Path $out 'github-mcp-server_Windows_x86_64.zip'
$githubSha = '15b658171f82622975f9d72037c7ad1ce8a5124cd1d516925c19c908a5b646d8'
if (-not (Test-Path -LiteralPath $githubZip)) {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 -OutFile $githubZip -Uri 'https://github.com/github/github-mcp-server/releases/download/v2.3.0/github-mcp-server_Windows_x86_64.zip'
}
if ((Get-FileHash -LiteralPath $githubZip).Hash -ne $githubSha) {
    throw 'O hash do servidor oficial GitHub MCP não confere.'
}
if (-not (Test-Path -LiteralPath $githubDir)) {
    Expand-Archive -LiteralPath $githubZip -DestinationPath $githubDir
} else {
    Expand-Archive -LiteralPath $githubZip -DestinationPath $githubDir -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Iniciar GitHub MCP.ps1') -Destination $githubDir -Force
$cfg = Join-Path $stage 'profile\config\opencode'
New-Item -ItemType Directory -Path $cfg -Force | Out-Null
$globalConfig = [ordered]@{
    model = 'opencode/deepseek-v4.1-flash-free'
    mcp = @{ servers = @{
        context7 = @{ type='remote'; url='https://mcp.context7.com/mcp' }
        github = @{ type='local'; command=@('powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '{env:OPENCODE_PORTABLE_ROOT}\apps\OpenCode\resources\github-mcp\Iniciar GitHub MCP.ps1') }
        'microsoft-learn' = @{ type='remote'; url='https://learn.microsoft.com/api/mcp'; oauth=$false }
    } }
}
[IO.File]::WriteAllText((Join-Path $cfg 'opencode.json'), ($globalConfig | ConvertTo-Json -Depth 8))
[IO.File]::WriteAllText((Join-Path $desktopHelpers 'mcp-defaults.json'), ($globalConfig.mcp.servers | ConvertTo-Json -Depth 8))
[IO.File]::WriteAllText((Join-Path $cfg 'AGENTS.md'), 'Converse sempre com o usuário em português do Brasil (pt-BR). Preserve comandos, código e identificadores quando a precisão exigir.')
$license = Join-Path $root 'LICENSE'
if (-not (Test-Path -LiteralPath $license)) { $license = Join-Path $out 'LICENSE' }
Copy-Item -LiteralPath $license -Destination $stage
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$stub = Join-Path $out 'installer-stub.exe'
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$stub" /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $PSScriptRoot 'Installer.cs')
if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador.' }
Copy-Item -LiteralPath $stub -Destination (Join-Path $desktopHelpers 'update-worker.exe') -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $out 'OpenCode-Infinite-PTBR-Update.zip'
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
$sums = foreach ($file in $result, $zip) {
    '{0}  {1}' -f (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant(), (Split-Path -Leaf $file)
}
$sums | Set-Content -LiteralPath (Join-Path $out 'SHA256SUMS.txt') -Encoding ascii
