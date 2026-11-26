param([switch]$NoLaunch)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $root 'OpenCode Infinite PT-BR.exe'
$icon = Join-Path $root 'apps\OpenCode\OpenCode.exe'
$wsh = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('Programs'))) {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { continue }
    $link = $wsh.CreateShortcut((Join-Path $folder 'OpenCode Infinite PT-BR.lnk'))
    $link.TargetPath = $launcher
    $link.Arguments = ''
    $link.WorkingDirectory = $root
    $link.IconLocation = "$icon,0"
    $link.Save()
}
foreach ($entry in @(@{ Path='shell'; Arg='%1' }, @{ Path='Background\shell'; Arg='%V' })) {
    $key = 'HKCU:\Software\Classes\Directory\' + $entry.Path + '\OpenCodeInfinitePtBr'
    New-Item -Path $key -Force | Out-Null
    Set-Item -LiteralPath $key -Value 'Abrir no OpenCode Infinite PT-BR'
    New-ItemProperty -LiteralPath $key -Name Icon -Value "$icon,0" -Force | Out-Null
    New-Item -Path "$key\command" -Force | Out-Null
    Set-Item -LiteralPath "$key\command" -Value ('"{0}" -Project "{1}\."' -f $launcher,$entry.Arg)
}
if (-not $NoLaunch) { Start-Process -FilePath $launcher -WorkingDirectory $root }
