# OpenCode Infinite PT-BR

Uma versão do **OpenCode** — o aplicativo de inteligência artificial para programar, escrever e criar — adaptada para **português do Brasil**, com telas e atalhos pensados para quem está começando.

Você não precisa saber programar para usar. É só digitar o que quer fazer, e a IA ajuda.

---

## Como instalar (passo a passo)

### 1. Baixe o instalador

1. Acesse a página de downloads: <https://github.com/haruzitz/opencode-infinite-ptbr/releases>
2. Na versão mais recente, clique em **`OpenCode-Infinite-PTBR-Setup.exe`** para baixar.

> Download direto da versão atual:
> <https://github.com/haruzitz/opencode-infinite-ptbr/releases/download/v0.2.0/OpenCode-Infinite-PTBR-Setup.exe>

### 2. Execute o instalador

1. Abra o arquivo baixado (geralmente fica na pasta **Downloads**).
2. Se o Windows mostrar o aviso azul do **SmartScreen** ("O Windows protegeu o seu PC"), clique em **"Mais informações"** e depois em **"Executar assim mesmo"**. Esse aviso aparece porque o programa não tem assinatura digital paga — é normal em projetos independentes.
3. Escolha a **pasta** onde o OpenCode vai ficar. Para guardar seus dados em outro disco (ex.: `D:`), selecione uma pasta nesse disco.
4. Aguarde. O instalador cria uma subpasta, um perfil novo e **atalhos** na Área de Trabalho e no Menu Iniciar.

### 3. Abra o aplicativo

Depois de instalado, abra pelo atalho **"OpenCode Infinite PT-BR"**.

---

## Primeiros passos (na primeira vez)

Ao abrir, você verá a tela de boas-vindas com cartões de sugestão. Faça nesta ordem:

1. **Adicione uma pasta de projeto** — na área **Projetos**, adicione a pasta onde você vai trabalhar.
2. **Escolha um cartão ou um modelo** — clique num cartão (ex.: **Programação**) para abrir uma conversa já preparada para aquele tipo de tarefa.
3. **(Opcional) Conecte o GitHub** — clique no ícone do GitHub para conectar sua conta e acompanhar repositórios.

Se você se perder, um guia **"Primeiros passos"** fica disponível na área de projetos até você escolher ocultá-lo.

---

## Funcionalidades

### 🗣️ Tudo em português

A interface abre em português do Brasil e a IA responde em português — inclusive ao trocar de projeto ou de modelo.

### 🃏 Cartões de tarefas

Na tela inicial há atalhos prontos para começar rápido:

| Cartão | O que ele faz | Modelo |
|---|---|---|
| **Geração de imagem** | Ajuda a escrever o prompt para criar imagens no Bing Image Creator | Nemotron Super VL Free |
| **Geração de vídeo** | Ajuda a montar o roteiro para criar vídeos no Runway | Nemotron 3 Ultra Free |
| **Programação** | Cria funções, corrige erros e escreve testes no seu projeto | DeepSeek V4.1 Flash Free |

Você também pode criar o **seu próprio cartão** clicando em **"+ Criar Card personalizado"**: dê um nome, escolha um modelo e pronto — ele fica salvo na tela inicial. Para mudar ou apagar, clique em **"Editar"** no cartão.

### 🧭 Barra lateral

A lateral esquerda organiza seu trabalho como no Codex:

- **Projetos separados** — cada pasta vira um grupo com seus próprios chats.
- **Chats por pasta** — as conversas de cada projeto ficam agrupadas.
- **Nova sessão** — cria um novo chat com um clique.
- **Buscar sessões** — encontra uma conversa rapidamente.

A barra lateral fica **ativa por padrão** e pode ser recolhida ou expandida pelo botão **"Alternar barra lateral"**.

### 📚 Biblioteca

Na barra lateral, o botão **"▦ Biblioteca"** abre um espaço onde você importa arquivos salvos no computador: imagens, vídeos, áudios, PDFs, textos e planilhas. Imagens, vídeos e áudios ganham **prévia**, e você pode baixar de volta qualquer arquivo importado.

### 🔄 Atualização automática

Quando uma **nova versão** for publicada neste repositório, o botão **"↻ Atualização"** aparece na barra lateral. Clique nele para abrir a página da versão e baixar o instalador novo. A verificação consulta apenas as versões lançadas pelo autor do projeto.

### 🐙 GitHub

O ícone do GitHub abre um painel com atalhos para trabalhar com seus repositórios:

- **Conectar conta** — faz login no GitHub usando o Git instalado no Windows.
- **Abrir aba do GitHub** — abre o GitHub dentro do próprio OpenCode.
- **Acompanhar com a IA** — pede um resumo de issues, pull requests e execuções do repositório.
- **Preparar envio com a IA** — a IA confere as alterações e prepara o envio (commit/push), pedindo a sua confirmação antes de qualquer mudança.
- **Configurar leitura da IA** — cola um token de leitura para a IA consultar o repositório (veja abaixo).

> A aba GitHub precisa do **Git for Windows** instalado. Baixe em <https://git-scm.com/download/win>.

#### Como configurar a leitura da IA (token)

Para a IA consultar seus repositórios, crie um token de **somente leitura**:

1. No painel GitHub, clique em **"Configurar leitura da IA"**.
2. Na janela que abrir, clique em **"Criar token no GitHub"**.
3. No site do GitHub, escolha os repositórios que a IA pode ler e marque **apenas leitura** para *Contents*, *Issues*, *Pull requests* e *Actions*.
4. Copie o token gerado (começa com `github_pat_`) e cole na janela.
5. Clique em **"Salvar e reiniciar o OpenCode"**.

O token fica criptografado no seu computador — nunca é enviado para este repositório.

### 📂 Abrir pelo Explorer

Depois de instalar, clique com o botão direito numa pasta no Windows e escolha **"Abrir no OpenCode Infinite PT-BR"** para abrir aquela pasta direto como projeto.

---

## Pré-requisitos

- **Windows 10 ou 11 (64 bits)**.
- **Git for Windows** (opcional, apenas para a aba GitHub): <https://git-scm.com/download/win>

---

## Perguntas frequentes

**"O Windows bloqueou o instalador."**
Clique em "Mais informações" → "Executar assim mesmo". É o aviso do SmartScreen para programas sem assinatura digital.

**"O antivírus acusou o arquivo."**
Como o programa não tem assinatura digital, alguns antivírus podem alertar. O arquivo de distribuição é independente e gerado a partir do código deste repositório. Confira o SHA-256 no arquivo `SHA256SUMS.txt` publicado junto com o instalador.

**"Onde ficam os meus dados?"**
Tudo fica na pasta que você escolheu durante a instalação — cartões, biblioteca, preferências e histórico. Nada é enviado para este repositório.

**"Como desinstalar?"**
Apague a pasta criada pelo instalador e remova os atalhos "OpenCode Infinite PT-BR".

**"Preciso pagar alguma coisa?"**
Não. Os cartões usam modelos gratuitos. Você pode adicionar seus próprios modelos ou chaves se quiser.

---

## Para desenvolvedores

Quer modificar, recompilar ou gerar o instalador? Consulte o [BUILD.md](BUILD.md).

---

## Sobre o projeto

Baseado no [OpenCode Desktop 2.2.5 para Windows x64](https://github.com/anomalyco/opencode/tree/v2.2.5), sob a [licença MIT](LICENSE). O binário distribuído inclui o aplicativo-base e os avisos de terceiros.

A distribuição inicial é uma prévia. A validação funcional em um Windows limpo está pendente.
