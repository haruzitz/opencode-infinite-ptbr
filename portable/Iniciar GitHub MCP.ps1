$ErrorActionPreference = 'Stop'

$github = Join-Path $PSScriptRoot 'github-mcp-server.exe'
if (-not (Test-Path -LiteralPath $github -PathType Leaf)) {
    [Console]::Error.WriteLine('O servidor GitHub MCP precisa ser instalado.')
    exit 1
}

$token = $env:OPENCODE_GITHUB_READ_TOKEN
Remove-Item Env:OPENCODE_GITHUB_READ_TOKEN -ErrorAction SilentlyContinue
if (-not $token) {
    foreach ($name in 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH') {
        $windowsValue = [Environment]::GetEnvironmentVariable("OPENCODE_WINDOWS_$name", 'Process')
        if ($windowsValue) { [Environment]::SetEnvironmentVariable($name, $windowsValue, 'Process') }
    }

    $git = Join-Path $env:ProgramFiles 'Git\mingw64\bin\git-credential-manager.exe'
    if (Test-Path -LiteralPath $git -PathType Leaf) {
        $env:GCM_INTERACTIVE = 'Never'
        $env:GIT_TERMINAL_PROMPT = '0'
        $request = "protocol=https$([char]10)host=github.com$([char]10)$([char]10)"
        $credential = $request | & $git get 2>$null
        if ($LASTEXITCODE -eq 0) {
            $password = $credential | Where-Object { $_.StartsWith('password=') } | Select-Object -First 1
            if ($password) { $token = $password.Substring(9) }
        }
    }
}

if (-not $token) {
    [Console]::Error.WriteLine('Entre no GitHub pelo painel de Plugins e tente novamente.')
    exit 1
}

$env:GITHUB_PERSONAL_ACCESS_TOKEN = $token
& $github stdio --read-only --toolsets=repos,issues,pull_requests,actions
exit $LASTEXITCODE
