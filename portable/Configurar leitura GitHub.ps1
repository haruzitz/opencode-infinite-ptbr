$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework

$root = Split-Path -Parent $PSScriptRoot
$profilePath = Join-Path $root 'profile'
$configPath = Join-Path $profilePath 'config\opencode\opencode.json'
$secretDirectory = Join-Path $profilePath 'secrets'
$secretPath = Join-Path $secretDirectory 'github-read.dpapi'
$tokenUrl = 'https://github.com/settings/personal-access-tokens/new'

$window = [Windows.Window]::new()
$window.Title = 'GitHub para a IA'
$window.Width = 490
$window.SizeToContent = 'Height'
$window.WindowStartupLocation = 'CenterScreen'
$window.ResizeMode = 'NoResize'
$panel = [Windows.Controls.StackPanel]::new()
$panel.Margin = [Windows.Thickness]::new(20)

$description = [Windows.Controls.TextBlock]::new()
$description.TextWrapping = 'Wrap'
$description.Text = 'Crie um token de acesso detalhado (fine-grained) no GitHub. Selecione os repositórios desejados e conceda somente leitura para Contents, Issues, Pull requests e Actions.'
$null = $panel.Children.Add($description)

$create = [Windows.Controls.Button]::new()
$create.Content = 'Criar token no GitHub'
$create.HorizontalAlignment = 'Left'
$create.Margin = [Windows.Thickness]::new(0, 10, 0, 14)
$create.Add_Click({ Start-Process $tokenUrl })
$null = $panel.Children.Add($create)

$label = [Windows.Controls.TextBlock]::new()
$label.Text = 'Token de leitura'
$null = $panel.Children.Add($label)
$password = [Windows.Controls.PasswordBox]::new()
$password.Margin = [Windows.Thickness]::new(0, 5, 0, 12)
$password.Height = 27
$null = $panel.Children.Add($password)

$status = [Windows.Controls.TextBlock]::new()
$status.TextWrapping = 'Wrap'
$status.Text = 'O token fica criptografado no D: para esta conta do Windows.'
$null = $panel.Children.Add($status)

$save = [Windows.Controls.Button]::new()
$save.Content = 'Salvar e reiniciar o OpenCode'
$save.IsDefault = $true
$save.HorizontalAlignment = 'Right'
$save.Margin = [Windows.Thickness]::new(0, 14, 0, 0)
$save.Add_Click({
    $secret = $password.SecurePassword
    try {
        if ([Net.NetworkCredential]::new('', $secret).Password -notmatch '^github_pat_[A-Za-z0-9_]+$') {
            $status.Text = 'Cole um token fine-grained do GitHub, que começa com github_pat_.'
            return
        }

        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        $server = $config.mcp.servers.github
        $server | Add-Member -NotePropertyName oauth -NotePropertyValue $false -Force
        $server.headers | Add-Member -NotePropertyName Authorization -NotePropertyValue 'Bearer {env:OPENCODE_GITHUB_READ_TOKEN}' -Force
        New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
        $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $secretPath -Encoding ascii
        $updatedConfig = $config | ConvertTo-Json -Depth 15
        [IO.File]::WriteAllText($configPath, $updatedConfig, [Text.UTF8Encoding]::new($false))
        $password.Clear()
        $window.DialogResult = $true
    } catch {
        $status.Text = 'Não foi possível salvar o token de leitura.'
    } finally {
        $secret.Dispose()
    }
})
$null = $panel.Children.Add($save)
$window.Content = $panel
$null = $password.Focus()
if ($window.ShowDialog() -ne $true) { return }

$app = Join-Path $root 'apps\OpenCode\OpenCode.exe'
foreach ($process in (Get-Process -Name OpenCode -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -eq $app -and $_.MainWindowHandle -ne 0
})) { [void]$process.CloseMainWindow() }

for ($attempt = 0; $attempt -lt 40 -and (Get-Process -Name OpenCode -ErrorAction SilentlyContinue |
    Where-Object Path -EQ $app); $attempt++) { Start-Sleep -Milliseconds 250 }
if (Get-Process -Name OpenCode -ErrorAction SilentlyContinue | Where-Object Path -EQ $app) {
    [void][Windows.MessageBox]::Show('O token foi salvo. Feche o OpenCode para concluir o reinício.', 'GitHub')
    return
}

$env:XDG_CONFIG_HOME = Join-Path $profilePath 'config'
$env:XDG_DATA_HOME = Join-Path $profilePath 'data'
$env:XDG_STATE_HOME = Join-Path $profilePath 'home\.local\state'
$env:XDG_CACHE_HOME = Join-Path $profilePath 'cache'
$cli = Join-Path $root 'apps\OpenCode\resources\opencode-cli.exe'
& $cli service stop *> $null
& (Join-Path $root 'Abrir OpenCode.ps1')
