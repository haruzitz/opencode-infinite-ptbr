param(
    [Parameter(Mandatory)][string]$Package,
    [Parameter(Mandatory)][string]$Sha256,
    [Parameter(Mandatory)][int]$OpenCodePid,
    [string]$InstallRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$root = (Get-Item -LiteralPath $InstallRoot).FullName
$launcher = Join-Path $root 'Abrir OpenCode.ps1'
$app = Join-Path $root 'apps\OpenCode'
$stage = Split-Path -Parent ([IO.Path]::GetFullPath($Package))
$updates = Join-Path $root '.updates'
if ((Split-Path -Parent $stage) -ne $updates -or (Split-Path -Leaf $stage) -notlike 'download-*' -or
    (Split-Path -Leaf $Package) -ne 'payload.zip') {
    throw 'Pacote fora da pasta de atualização.'
}
$unpacked = Join-Path $stage 'unpacked'
$oldApp = Join-Path $stage 'previous-app'
$oldLauncher = Join-Path $stage 'previous-launcher.ps1'
$newApp = Join-Path $unpacked 'apps\OpenCode'
$newLauncher = Join-Path $unpacked 'Abrir OpenCode.ps1'
$windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$appMoved = $newAppMoved = $launcherReplaced = $retainBackup = $false
$expectedProcess = Join-Path $app 'OpenCode.exe'
if (!(Test-Path -LiteralPath $expectedProcess -PathType Leaf) -or
    !(Test-Path -LiteralPath $launcher -PathType Leaf)) { throw 'Instalação portátil não localizada.' }
foreach ($directory in $root, $updates, $stage, $app) {
    if ((Get-Item -LiteralPath $directory).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) {
        throw 'A atualização encontrou uma pasta redirecionada.'
    }
}
function Open-Desktop {
    Start-Process -FilePath $windowsPowerShell -ArgumentList @(
        '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $launcher + '"')
    ) -WorkingDirectory $root -WindowStyle Hidden
}

try {
    if ((Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash -ne $Sha256) {
        throw 'A integridade do pacote não confere.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($Package, $unpacked)
    foreach ($file in (Join-Path $newApp 'OpenCode.exe'), (Join-Path $newApp 'resources\app.asar'),
        (Join-Path $newApp 'resources\portable\Aplicar atualização.ps1'), $newLauncher) {
        if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw 'O pacote de atualização está incompleto.' }
    }
    [IO.File]::WriteAllText((Join-Path $stage 'ready'), 'ready')
    $running = Get-Process -Id $OpenCodePid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq $expectedProcess -and !$running.WaitForExit(30000)) {
        throw 'O OpenCode ainda está aberto. Feche o aplicativo e tente novamente.'
    }
    for ($attempt = 0; ; $attempt++) {
        try { [IO.Directory]::Move($app, $oldApp); break }
        catch [IO.IOException] {
            if ($attempt -ge 20) { throw }
            Start-Sleep -Milliseconds 250
        }
    }
    $appMoved = $true
    [IO.Directory]::Move($newApp, $app)
    $newAppMoved = $true
    [IO.File]::Replace($newLauncher, $launcher, $oldLauncher)
    $launcherReplaced = $true
    Open-Desktop
} catch {
    $message = $_.Exception.Message
    try {
        $retainBackup = $appMoved
        if ($launcherReplaced) { [IO.File]::Replace($oldLauncher, $launcher, [System.Management.Automation.Language.NullString]::Value) }
        if ($newAppMoved) { [IO.Directory]::Move($app, (Join-Path $stage 'failed-app')) }
        if ($appMoved) { [IO.Directory]::Move($oldApp, $app) }
        $retainBackup = $false
        if ((Get-Process -Id $OpenCodePid -ErrorAction SilentlyContinue).Path -ne $expectedProcess) { Open-Desktop }
    } catch {
        $message += [Environment]::NewLine + $_.Exception.Message + [Environment]::NewLine + $stage
    }
    [Console]::Error.WriteLine($message)
    if ((Get-Process -Id $OpenCodePid -ErrorAction SilentlyContinue).Path -ne $expectedProcess) {
        Add-Type -AssemblyName System.Windows.Forms
        [void][Windows.Forms.MessageBox]::Show($message, 'Atualização do OpenCode')
    }
    exit 1
} finally {
    if (!$retainBackup -and (Test-Path -LiteralPath $stage)) {
        $resolved = Get-Item -LiteralPath $stage
        if ($resolved.FullName -eq $stage -and !$resolved.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint) -and
            !(Get-ChildItem -LiteralPath $stage -Force -Recurse -Attributes ReparsePoint -ErrorAction SilentlyContinue | Select-Object -First 1)) {
            Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}
