$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$case = Join-Path $root ('downloads\overlay-proof-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path (Join-Path $case 'portable') | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'portable\Launch-WithHeadroom.ps1') -Destination (Join-Path $case 'portable\Launch-WithHeadroom.ps1')
# Isolate the setup dependency; exercise the real wrapper against two successive
# versions of an official launcher, including project argument forwarding.
[IO.File]::WriteAllText((Join-Path $case 'portable\Start-Headroom.ps1'), 'function Start-PortableHeadroom { param($Root) $env:HEADROOM_OVERLAY_TEST = "configured" }')
foreach ($version in @('old', 'updated')) {
    $script = 'param([string]$Project); if ($env:HEADROOM_OVERLAY_TEST -ne "configured") { throw "Headroom overlay missing" }; if ($Project -ne "project with spaces") { throw "Project argument lost" }; Write-Output "VERSION"'
    [IO.File]::WriteAllText((Join-Path $case 'Abrir OpenCode.ps1'), $script.Replace('VERSION', $version))
    $output = & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File (Join-Path $case 'portable\Launch-WithHeadroom.ps1') -Project 'project with spaces'
    if ($LASTEXITCODE -ne 0 -or $output -ne $version) { throw 'A camada local falhou após substituir o launcher oficial.' }
}
Write-Host 'PASS: wrapper preserva Headroom e encaminha o projeto após substituir o launcher oficial.'
