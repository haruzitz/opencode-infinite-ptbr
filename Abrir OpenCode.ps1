[CmdletBinding()]
param(
    [string]$Project
)

$ErrorActionPreference = 'Stop'

$windowsProfileVariables = 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP'
foreach ($variable in $windowsProfileVariables) {
    $savedName = 'OPENCODE_WINDOWS_' + $variable
    if (-not [Environment]::GetEnvironmentVariable($savedName, 'Process')) {
        $originalValue = [Environment]::GetEnvironmentVariable($variable, 'Process')
        [Environment]::SetEnvironmentVariable($savedName, $originalValue, 'Process')
    }
}

$projectPath = $null
if ($Project) {
    $folder = Get-Item -LiteralPath $Project
    if (-not $folder.PSIsContainer -or $folder.PSProvider.Name -ne 'FileSystem') {
        throw 'Selecione uma pasta do Windows.'
    }
    $projectPath = $folder.FullName
}

$profilePath = Join-Path $PSScriptRoot 'profile'
$env:OPENCODE_DESKTOP_TEST_ROOT = $profilePath
$env:APPDATA = Join-Path $profilePath 'appdata'
$env:LOCALAPPDATA = Join-Path $profilePath 'localappdata'
$env:USERPROFILE = Join-Path $profilePath 'home'
$env:HOMEDRIVE = [IO.Path]::GetPathRoot($env:USERPROFILE).TrimEnd('\')
$env:HOMEPATH = $env:USERPROFILE.Substring($env:HOMEDRIVE.Length)
$env:TEMP = Join-Path $profilePath 'temp'
$env:TMP = $env:TEMP
$env:XDG_CONFIG_HOME = Join-Path $profilePath 'config'
$env:XDG_DATA_HOME = Join-Path $profilePath 'data'
$env:XDG_STATE_HOME = Join-Path $profilePath 'home\.local\state'
$env:XDG_CACHE_HOME = Join-Path $profilePath 'cache'

foreach ($folder in @($env:APPDATA, $env:LOCALAPPDATA, $env:USERPROFILE, $env:TEMP)) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$githubCredential = Join-Path $profilePath 'secrets\github-read.dpapi'
if (Test-Path -LiteralPath $githubCredential -PathType Leaf) {
    $secret = Get-Content -LiteralPath $githubCredential -Raw | ConvertTo-SecureString
    try {
        $env:OPENCODE_GITHUB_READ_TOKEN = [Net.NetworkCredential]::new('', $secret).Password
    } finally {
        $secret.Dispose()
    }
}

$appPath = Join-Path $PSScriptRoot 'apps\OpenCode'
$app = Join-Path $appPath 'OpenCode.exe'

# Encerra qualquer serviço antigo deste perfil para liberar a porta (evita "port already in use").
$cli = Join-Path $appPath 'resources\opencode-cli.exe'
if (Test-Path -LiteralPath $cli -PathType Leaf) {
    & $cli service stop *> $null
}
Get-CimInstance Win32_Process -Filter "Name='opencode-cli.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -like ($profilePath + '*') } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if ($projectPath) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($projectPath))
    $encoded = $encoded.TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Start-Process -FilePath $app -WorkingDirectory $PSScriptRoot -ArgumentList @('--lang=pt-BR', "--portable-project=$encoded")
    return
}

Start-Process -FilePath $app -WorkingDirectory $PSScriptRoot -ArgumentList '--lang=pt-BR'
