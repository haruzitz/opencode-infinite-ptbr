[CmdletBinding()]
param([string]$Project)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
# The official launcher remains unchanged and can be replaced by its updater.
# The local wrapper and runtime live outside the updater's replacement paths.
. (Join-Path $PSScriptRoot 'Start-Headroom.ps1')
Start-PortableHeadroom -Root $root
& (Join-Path $root 'Abrir OpenCode.ps1') @PSBoundParameters
