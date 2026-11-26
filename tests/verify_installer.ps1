param([Parameter(Mandatory)][string]$Installer)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root ('downloads\installer proof ' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $base | Out-Null
$process = Start-Process -FilePath (Resolve-Path -LiteralPath $Installer).Path -ArgumentList @('--install-dir', ('"' + $base + '"'), '--test') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $base 'installer.log') -RedirectStandardError (Join-Path $base 'installer-error.log')
if ($process.ExitCode -ne 0) { Get-Content (Join-Path $base 'installer-error.log'); throw "Instalador falhou: $($process.ExitCode). Destino: $base" }
$installed = Join-Path $base 'OpenCode Infinite PT-BR'
foreach ($name in @('OpenCode Infinite PT-BR.exe', 'Abrir OpenCode.ps1', 'portable\Start-Headroom.ps1', 'portable\Launch-WithHeadroom.ps1', 'apps\OpenCode\OpenCode.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $installed $name))) { throw "Arquivo não instalado: $name" }
}
if (@(Get-ChildItem -LiteralPath $base -Filter '*.tmp').Count -or @(Get-ChildItem -LiteralPath $base -Filter '*.tmp.zip').Count) {
    throw 'Instalação deixou uma pasta temporária ativa.'
}
Write-Host "PASS: instalação completa em caminho com espaços: $installed"
$wrapper = Join-Path $installed 'portable\Launch-WithHeadroom.ps1'
Add-Content -LiteralPath $wrapper -Value '# local-extension-sentinel'
$wrapperHash = (Get-FileHash -LiteralPath $wrapper).Hash
$nativeHash = (Get-FileHash -LiteralPath (Join-Path $installed 'OpenCode Infinite PT-BR.exe')).Hash
$history = Join-Path $installed 'profile\history-sentinel.txt'
Set-Content -LiteralPath $history -Value 'preserve-history'
$historyHash = (Get-FileHash -LiteralPath $history).Hash
$official = Join-Path $installed 'Abrir OpenCode.ps1'
$officialHash = (Get-FileHash -LiteralPath $official).Hash
Add-Content -LiteralPath $official -Value '# old-launcher-sentinel'
$process = Start-Process -FilePath (Resolve-Path -LiteralPath $Installer).Path -ArgumentList @('--update', ('"' + $installed + '"'), '0', '--test') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $base 'update.log') -RedirectStandardError (Join-Path $base 'update-error.log')
if ($process.ExitCode -ne 0) { Get-Content (Join-Path $base 'update-error.log'); throw 'Atualização falhou.' }
if ((Get-FileHash -LiteralPath $wrapper).Hash -ne $wrapperHash) { throw 'Atualização substituiu a extensão local.' }
if ((Get-FileHash -LiteralPath (Join-Path $installed 'OpenCode Infinite PT-BR.exe')).Hash -ne $nativeHash) { throw 'Atualização substituiu o launcher local.' }
if ((Get-FileHash -LiteralPath $history).Hash -ne $historyHash) { throw 'Atualização alterou o perfil.' }
if ((Get-FileHash -LiteralPath $official).Hash -ne $officialHash) { throw 'Launcher oficial não foi atualizado.' }
Write-Host 'PASS: atualização substituiu o launcher oficial e preservou wrapper, executável local e histórico.'
