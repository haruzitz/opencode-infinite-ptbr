# OpenCode Infinite PT-BR

Personalização por **Haruzitz**, baseada no OpenCode Desktop 2.2.5 para Windows x64.

## Instalação

Baixe `OpenCode-Infinite-PTBR-Setup.exe` nos Releases e escolha onde instalar. Para manter os dados no disco D:, selecione uma pasta nesse disco. O instalador cria uma subpasta, um perfil novo e atalhos no Windows. O executável de distribuição é independente e não tem assinatura digital.

## O que mudou

- **Português do Brasil** como idioma inicial da interface e instrução global de conversa, inclusive ao trocar de projeto ou de modelo.
- **Primeiros passos** com orientações para abrir um projeto, selecionar um modelo e conectar o GitHub.
- **Cartões de tarefas**, com modelos pré-selecionados e cartões personalizados editáveis.
- **Biblioteca** acessível na área de projetos. Importe mídias e documentos que você salvou no computador. Imagens, vídeos e áudios compatíveis têm prévia. Arquivos gerados no Bing ou Runway podem ser baixados e importados.
- **GitHub** em uma aba interna, com atalho para autenticar o Git do Windows, acompanhar o repositório pela IA e preparar um envio. Cada pessoa conecta as próprias credenciais.
- **Abertura de projetos no Explorer** pela opção **Abrir no OpenCode Infinite PT-BR**.

Os cartões, a biblioteca, as preferências e o histórico ficam no perfil da instalação. O projeto público contém apenas código, scripts e documentação. O binário distribuído inclui o aplicativo-base e os avisos de terceiros. Consulte [o projeto original](https://github.com/anomalyco/opencode/tree/v2.2.5) e [a licença do OpenCode](LICENSE).

## Atualizações futuras

- Adição opcional de modelos de IA local.
- Salvamento de mídias diretamente pela conversa.
- Revisão das traduções e ferramentas para exportar a Biblioteca.

A base permanece na versão 2.2.5. A distribuição inicial é uma prévia e a validação funcional em um Windows limpo está pendente.

## Compilar

Use PowerShell 7, Node.js 24 e o .NET Framework do Windows. Aponte o script para a pasta de instalação original do OpenCode Desktop Windows x64 2.2.5 e para uma pasta de saída nova.

```powershell
& '.\portable\Build release.ps1' -OpenCodeApp 'D:\caminho\OpenCode-original' -Output 'D:\caminho\saida'
```
