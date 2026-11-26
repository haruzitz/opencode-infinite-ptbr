function Initialize-PortableService {
    param([Parameter(Mandatory)][string]$Cli)
    if (-not (Test-Path -LiteralPath $Cli -PathType Leaf)) { throw 'CLI do OpenCode não encontrado.' }
    # The desktop rewrites XDG_STATE_HOME to <profile>\state. The caller must
    # use that same directory before asking the CLI to stop its own service.
    & $Cli service stop *> $null
    # Select a private port instead of competing for the shared default 28894.
    # Never terminate the owner of an occupied port.
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        $port = $listener.LocalEndpoint.Port
    } finally { $listener.Stop() }
    & $Cli service set port "$port" *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível configurar a porta do serviço deste perfil.' }
    Write-Host "OpenCode: serviço local configurado na porta $port."
    return $port
}
