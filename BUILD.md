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

## Integração Headroom

O build personalizado (`portable/Build headroom.ps1`) inclui `Configurar Headroom.ps1`, `Start-Headroom.ps1`, `headroom-runtime.py` e `headroom-requirements.txt` no payload. A instalação Python é opcional e ocorre na máquina de destino; não copie a venv de outra máquina ou pasta para o instalador. O launcher injeta o diretório do plugin oficial em `OPENCODE_CONFIG_CONTENT`, sem trocar o modelo nem sobrescrever o arquivo de configuração do usuário.

O serviço usa Headroom 0.45.0, compressão em modo token, sem Kompress/modelos adicionais, sem cache semântico de respostas e sem acompanhamento de assinaturas. Uma ponte HTTP CONNECT encaminha HTTPS pela seleção de rede do desktop; nenhuma credencial de provedor é lida pela ponte. Proxies com autenticação recebem apenas sua própria credencial de proxy. Conexões do provedor não ficam em pool entre requisições, para que novas conexões leiam a seleção atual.

Verificações:

```powershell
python -m unittest discover -s tests -v
& '.\profile\headroom\venv\Scripts\python.exe' tests/verify_headroom_opencode.py
```

O segundo comando exige a integração instalada e `apps\OpenCode\resources\opencode-cli.exe`. Executa OpenCode e Headroom reais contra um provedor HTTPS/SSE local, com configuração isolada e credenciais fictícias. Os artefatos ficam em `downloads\headroom-proof`. Os testes não confirmam disponibilidade ou cotas dos modelos externos.

Limitação conhecida do build original: o pacote oficial 2.2.5 baixado durante a validação tem nomes/estrutura de bundles diferentes dos esperados em `patch-desktop.cjs`. O build para antes de gerar o instalador. A integração Headroom pode ser testada com o aplicativo já personalizado da release v0.2.0; o patch da base precisa ser atualizado separadamente para recompilar a distribuição a partir do pacote oficial.

Para gerar um instalador a partir do aplicativo já personalizado, com preparação do Headroom na primeira abertura:

```powershell
& '.\portable\Build headroom.ps1' -OpenCodeApp '.\apps\OpenCode' -Output '.\Distribuicao\novo-build' -PreparedApp -EnableHeadroom
```

`portable/Build headroom.ps1 -PreparedApp` verifica os marcadores de personalização antes de empacotar. `patch-service-state.cjs` corrige a inicialização do Desktop no Windows para preservar o estado do perfil portátil; sem esse ajuste, o aplicativo descarta `XDG_STATE_HOME` e pode reencontrar um serviço de outro perfil. O launcher oficial v0.2.2 e o Desktop usam `profile\home\.local\state`; a escolha de porta permanece sob responsabilidade do launcher oficial. O teste `tests\verify_service_port.ps1` mantém 28894 ocupada e inicia o serviço real em outra porta; `tests\verify_desktop_startup.ps1 -AppPath <pasta-do-app>` verifica a inicialização do Desktop com perfil temporário e Headroom.

`-EnableHeadroom` inclui apenas a opção de instalação automática, sem credenciais ou caches locais. Na primeira abertura, o ambiente Python é criado na pasta de destino e as dependências são baixadas. É necessário Python 3.11+ instalado e acesso à internet.

O build compila também `Launcher.cs` como `OpenCode Infinite PT-BR.exe`. Os atalhos apontam para esse executável, que mostra progresso durante a preparação e registra erros em `profile\launcher.log`. O instalador aguarda a extração, a troca da pasta temporária pela definitiva e a criação dos atalhos antes de iniciar o launcher. Os dois executáveis habilitam caminhos longos do Windows. `tests\verify_installer.ps1 -Installer <arquivo.exe>` testa a extração completa em um caminho longo com espaços, sem criar atalhos nem abrir o aplicativo.

## Atualizar o código oficial sem sobrescrever o Headroom

`main` acompanha o upstream; o desenvolvimento local fica em `integracao/headroom`. Os arquivos oficiais `Abrir OpenCode.ps1`, `Installer.cs`, `Build release.ps1` e `Registrar atalhos.ps1` permanecem iguais aos oficiais. A camada local usa `Launch-WithHeadroom.ps1`, `Installer.Headroom.cs`, `UpdateExisting.Headroom.cs`, `Build headroom.ps1` e `Registrar atalhos.Headroom.ps1`.

Com o trabalho local salvo, atualize `main` por fast-forward e depois faça merge dela na branch de integração. Não execute `pull --rebase` sobre alterações ainda não salvas. Execute os testes antes de gerar uma nova distribuição. Não há garantia de ausência de conflitos em mudanças futuras de API ou formato do aplicativo.

`upstream-compatibility.json` registra o contrato revisado da v0.2.2: o updater troca `apps/OpenCode` e `Abrir OpenCode.ps1`, preservando o perfil, `portable` e o launcher nativo local. O build personalizado executa `verify-upstream.cjs` e para se o método oficial de atualização mudar. Revise a mudança, repita `verify_installer.ps1` e só então atualize o contrato. Esse teste verifica uma instalação e uma atualização reais, preservando por hash o wrapper local, o executável e um arquivo de histórico de teste.

O teste `verify_launch_overlay.ps1` substitui duas versões do launcher oficial em um ambiente isolado e confirma que o wrapper mantém o Headroom e o argumento de projeto. A instalação existente do usuário não é alterada por esse processo de sincronização do código.
