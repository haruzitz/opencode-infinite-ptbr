# Compilando o OpenCode Infinite PT-BR

Este documento é para quem quer gerar o instalador ou modificar a personalização. Para usar o aplicativo, veja o [README.md](README.md).

## O que o projeto faz

A personalização é aplicada em cima do **OpenCode Desktop 2.2.5 para Windows x64**. O script de build:

1. Copia a instalação original do OpenCode.
2. Aplica as alterações de interface (português, cartões, biblioteca, GitHub, abertura pelo Explorer) diretamente no arquivo `app.asar`.
3. Gera um perfil limpo com configuração padrão e instrução de conversa em português.
4. Compila um instalador em C# (`Installer.cs`) e junta tudo num único `OpenCode-Infinite-PTBR-Setup.exe`.

## Pré-requisitos

- **PowerShell 7** (ou superior).
- **Node.js 24** (usado para aplicar os patches no `app.asar`).
- **.NET Framework 4.x** do Windows (o compilador `csc.exe` já vem com o Windows).
- A pasta de instalação original do **OpenCode Desktop Windows x64 2.2.5**.

## Como compilar

Aponte o script para a pasta original do OpenCode e para uma pasta de saída nova:

```powershell
& '.\portable\Build release.ps1' -OpenCodeApp 'D:\caminho\OpenCode-original' -Output 'D:\caminho\saida'
```

O script gera, na pasta de saída:

| Arquivo | Descrição |
|---|---|
| `OpenCode-Infinite-PTBR-Setup.exe` | Instalador único para distribuição |
| `payload.zip` | Conteúdo compactado que o instalador extrai |
| `installer-stub.exe` | Executável do instalador (sem o payload) |
| `app.asar` | Aplicativo com as personalizações aplicadas |
| `SHA256SUMS.txt` | Hash SHA-256 do instalador |

## Estrutura dos patches

| Arquivo | O que modifica |
|---|---|
| `patch-desktop.cjs` | Aplica os patches dentro do `app.asar` |
| `desktop-home-categories.js` | Cartões da tela inicial |
| `desktop-custom-cards.js` | Cartões personalizados |
| `desktop-library.js` | Biblioteca (importar/ver arquivos) |
| `desktop-sidebar.js` | Itens da barra lateral (biblioteca + verificação de atualização) |
| `desktop-github-main.js` | Integração com o Git do Windows (processo principal) |
| `desktop-github-renderer.js` | Painel do GitHub na interface |
| `desktop-project-main.js` / `desktop-project-renderer.js` | Abertura de projetos pelo Explorer |
| `Installer.cs` | Instalador (seleciona pasta, extrai e registra atalhos) |
| `Registrar atalhos.ps1` | Cria atalhos e a opção de menu de contexto |
| `Configurar leitura GitHub.ps1` | Janela para salvar o token de leitura |

## Como publicar uma nova versão

1. Rode o script de build acima.
2. Confira o `SHA256SUMS.txt` gerado.
3. Crie uma **Release** no GitHub e anexe o `OpenCode-Infinite-PTBR-Setup.exe` e o `SHA256SUMS.txt`.
4. Atualize o link de download no [README.md](README.md), se necessário.

Os binários (`*.exe`, `*.zip`, `*.asar`) não vão para o repositório Git — ficam apenas na Release (veja o `.gitignore`).
