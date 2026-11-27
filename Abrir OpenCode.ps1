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
$env:OPENCODE_PORTABLE_ROOT = $PSScriptRoot
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

function Update-ConnectorDefaults([string]$configDirectory) {
    $defaultsPath = Join-Path $appPath 'resources\portable\mcp-defaults.json'
    if (-not (Test-Path -LiteralPath $defaultsPath -PathType Leaf)) { return }
    $path = Join-Path $configDirectory 'opencode.json'
    # Keep custom JSONC configurations authoritative.
    if (Test-Path -LiteralPath (Join-Path $configDirectory 'opencode.jsonc')) { return }
    $pending = $null
    try {
        $exists = Test-Path -LiteralPath $path -PathType Leaf
        $settings = if ($exists) { Get-Content -LiteralPath $path -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
        if ($settings -isnot [pscustomobject]) { return }
        $defaults = Get-Content -LiteralPath $defaultsPath -Raw | ConvertFrom-Json
        if (-not $settings.PSObject.Properties['mcp']) {
            $settings | Add-Member -NotePropertyName mcp -NotePropertyValue ([pscustomobject]@{})
        }
        if ($settings.mcp -isnot [pscustomobject]) { return }
        if (-not $settings.mcp.PSObject.Properties['servers']) {
            $settings.mcp | Add-Member -NotePropertyName servers -NotePropertyValue ([pscustomobject]@{})
        }
        $servers = $settings.mcp.servers
        if ($servers -isnot [pscustomobject]) { return }
        $changed = $false
        foreach ($default in $defaults.PSObject.Properties) {
            if ($servers.PSObject.Properties[$default.Name]) { continue }
            $servers | Add-Member -NotePropertyName $default.Name -NotePropertyValue $default.Value
            $changed = $true
        }
        $github = $servers.github
        if ($github.type -eq 'remote' -and $github.url -eq 'https://api.githubcopilot.com/mcp/' -and
            $github.enabled -ne $false -and -not $github.PSObject.Properties['oauth'] -and
            -not ($github.headers.PSObject.Properties.Name | Where-Object { $_ -notin 'X-MCP-Readonly','X-MCP-Toolsets' })) {
            $servers.github = $defaults.github
            $changed = $true
        }
        if (-not $changed) { return }
        $pending = $path + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
        [IO.File]::WriteAllText($pending, ($settings | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
        if ($exists) { [IO.File]::Replace($pending, $path, [System.Management.Automation.Language.NullString]::Value) }
        else { [IO.File]::Move($pending, $path) }
    } catch {
        Write-Warning 'As configurações de conectores foram preservadas.'
    } finally {
        if ($pending -and (Test-Path -LiteralPath $pending)) { Remove-Item -LiteralPath $pending -Force }
    }
}

function Get-AvailablePort([int]$port) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try {
        $listener.Start()
        return $listener.LocalEndpoint.Port
    } catch [Net.Sockets.SocketException] {
        if ($port -eq 0) { throw }
        return $null
    } finally { $listener.Stop() }
}

if (-not (Get-Process -Name OpenCode -ErrorAction SilentlyContinue | Where-Object Path -EQ $app)) {
    $configDirectory = Join-Path $env:XDG_CONFIG_HOME 'opencode'
    New-Item -ItemType Directory -Force -Path $configDirectory | Out-Null
    Update-ConnectorDefaults $configDirectory
    $configPath = Join-Path $configDirectory 'service.json'
    $configuration = [pscustomobject]@{}
    if (Test-Path -LiteralPath $configPath -PathType Leaf) {
        $configuration = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    }
    $port = [int]$configuration.port
    $reuse = $false
    $registration = Join-Path $env:XDG_STATE_HOME 'opencode\service.json'
    if ($port -gt 0 -and (Test-Path -LiteralPath $registration -PathType Leaf)) {
        $stalePid = $null
        try {
            $state = Get-Content -LiteralPath $registration -Raw | ConvertFrom-Json
            $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("opencode:$($state.password)"))
            $info = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/info" -Headers @{Authorization=$auth} -UseBasicParsing -TimeoutSec 2
            $reuse = ($info.StatusCode -eq 200) -and ($state.url -eq "http://127.0.0.1:$port")
            if (-not $reuse) { $stalePid = $state.pid }
        } catch {
            try {
                $state = Get-Content -LiteralPath $registration -Raw | ConvertFrom-Json
                $stalePid = $state.pid
            } catch {}
            $reuse = $false
        }
        # Serviço zumbi (escuta na porta mas não responde): encerra o processo do perfil para liberar a porta.
        if ($stalePid) {
            try {
                $owner = Get-Process -Id $stalePid -ErrorAction Stop
                $expectedPrefix = (Join-Path $profilePath 'desktop\cli') + '\'
                if ($owner.Path -and $owner.Path.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                    Stop-Process -Id $stalePid -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
    }
    if (-not $reuse -and ($port -le 0 -or -not (Get-AvailablePort $port))) {
        $port = Get-AvailablePort 0
    }
    if ($configuration.port -ne $port) {
        $configuration | Add-Member -NotePropertyName port -NotePropertyValue $port -Force
        $configuration | Add-Member -NotePropertyName hostname -NotePropertyValue '127.0.0.1' -Force
        [IO.File]::WriteAllText($configPath, ($configuration | ConvertTo-Json -Depth 15), [Text.UTF8Encoding]::new($false))
    }
}

if ($projectPath) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($projectPath))
    $encoded = $encoded.TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Start-Process -FilePath $app -WorkingDirectory $PSScriptRoot -ArgumentList @('--lang=pt-BR', "--portable-project=$encoded")
    return
}

Start-Process -FilePath $app -WorkingDirectory $PSScriptRoot -ArgumentList '--lang=pt-BR'
