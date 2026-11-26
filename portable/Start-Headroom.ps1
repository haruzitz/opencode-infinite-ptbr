function Get-PortableHeadroomHealth {
    param([string]$Url)
    $request = [Net.WebRequest]::Create($Url)
    $request.Proxy = $null
    $request.Timeout = 2000
    $response = $request.GetResponse()
    try {
        $reader = New-Object IO.StreamReader($response.GetResponseStream())
        try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
    } finally { $response.Dispose() }
}

function Start-PortableHeadroom {
    param([Parameter(Mandatory)][string]$Root)
    $runtime = Join-Path $Root 'profile\headroom'
    $settingsFile = Join-Path $runtime 'settings.json'
    if (-not (Test-Path -LiteralPath $settingsFile)) { return }
    $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
    if (-not $settings.enabled) { return }
    $port = [int]$settings.port
    if ($port -lt 1024 -or $port -gt 65535) { throw 'Porta inválida nas configurações do Headroom.' }
    $python = Join-Path $runtime 'venv\Scripts\python.exe'
    if ($settings.installOnFirstRun) {
        Write-Host 'Preparando Headroom na primeira abertura. A instalação requer Python e internet.'
        & (Join-Path $Root 'portable\Configurar Headroom.ps1')
        $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
        $port = [int]$settings.port
    }
    if (-not (Test-Path -LiteralPath $python)) { throw 'Headroom não instalado. Execute portable\Configurar Headroom.ps1.' }
    $plugin = & $python -c 'from headroom.providers.opencode.runtime import headroom_opencode_plugin_path; print(headroom_opencode_plugin_path())'
    if ($LASTEXITCODE -or -not $plugin -or -not (Test-Path -LiteralPath $plugin.Trim())) {
        throw 'Plugin Headroom ausente. Execute portable\Configurar Headroom.ps1.'
    }
    # Build the launch overlay before starting anything. Preserve user configuration.
    $overlay = New-Object PSObject
    if ($env:OPENCODE_CONFIG_CONTENT) {
        if (-not $env:OPENCODE_CONFIG_CONTENT.TrimStart().StartsWith('{')) { throw 'OPENCODE_CONFIG_CONTENT deve conter um objeto JSON.' }
        $overlay = ConvertFrom-Json -InputObject $env:OPENCODE_CONFIG_CONTENT
    }
    $entries = @($overlay.plugins)
    if (-not ($entries | Where-Object { $_ -and $_.package -eq $plugin.Trim() })) {
        $plugins = @($entries | Where-Object { $_ }) + @(@{ package = $plugin.Trim() })
        $overlay | Add-Member -MemberType NoteProperty -Name plugins -Value $plugins -Force
    }
    $baseUrl = "http://127.0.0.1:$port"
    $health = $null
    try { $health = Get-PortableHeadroomHealth "$baseUrl/portable-health" } catch { }
    if ($health -and ($health.service -ne 'headroom-proxy' -or $health.portable_profile -ne (Join-Path $Root 'profile'))) {
        throw "A porta $port pertence a outro serviço. Escolha outra com Configurar Headroom.ps1 -Port."
    }
    if (-not $health) {
        $worker = Join-Path $Root 'portable\headroom-runtime.py'
        $arguments = @(('"' + $worker + '"'), '--profile', ('"' + (Join-Path $Root 'profile') + '"'), '--port', "$port")
        $process = Start-Process -FilePath $python -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'runtime.log') -RedirectStandardError (Join-Path $runtime 'runtime-error.log')
        $deadline = [DateTime]::UtcNow.AddSeconds(90)
        do {
            Start-Sleep -Milliseconds 500
            if ($process.HasExited) { throw 'Headroom não iniciou. Consulte profile\headroom\runtime-error.log.' }
            try { $health = Get-PortableHeadroomHealth "$baseUrl/portable-health" } catch { }
        } until (($health -and $health.portable_profile -eq (Join-Path $Root 'profile')) -or [DateTime]::UtcNow -gt $deadline)
        if (-not $health -or $health.portable_profile -ne (Join-Path $Root 'profile')) {
            Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
            throw 'Headroom não ficou pronto em 90 segundos. Consulte os logs em profile\headroom.'
        }
    }
    $env:HEADROOM_PROXY_URL = $baseUrl
    $env:OPENCODE_CONFIG_CONTENT = $overlay | ConvertTo-Json -Depth 50 -Compress
    Write-Host "Headroom ativo em $baseUrl."
}
