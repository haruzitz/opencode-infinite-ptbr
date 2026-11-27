# OpenCode Infinite PT-BR

Uma versão do **OpenCode** — o aplicativo de inteligência artificial para programar, escrever e criar — adaptada para **português do Brasil**, com telas e atalhos pensados para quem está começando.

Você não precisa saber programar para usar. É só digitar o que quer fazer, e a IA ajuda.

---

## Como instalar (passo a passo)

1. Baixe o [instalador para Windows](https://github.com/haruzitz/opencode-infinite-ptbr/releases/latest/download/OpenCode-Infinite-PTBR-Setup.exe).
2. Abra o arquivo e escolha a pasta em que quer instalar. Você pode escolher outro disco, como `D:`.
3. Aguarde a instalação. O aplicativo abre sozinho e cria o atalho **OpenCode Infinite PT-BR** na Área de Trabalho e no Menu Iniciar.

O instalador cria a subpasta **OpenCode Infinite PT-BR** dentro do local escolhido. Se você já usa o aplicativo, abra **Verificar atualizações** na barra lateral.

Cada publicação inclui os hashes dos arquivos e as instruções de atualização. [Versões publicadas](https://github.com/haruzitz/opencode-infinite-ptbr/releases)

---

## Primeiros passos (na primeira vez)

Ao abrir, você verá a tela de boas-vindas com cartões de sugestão. Faça nesta ordem:

1. **Adicione uma pasta de projeto** — na área **Projetos**, adicione a pasta onde você vai trabalhar.
2. **Escolha um cartão ou um modelo** — clique num cartão (ex.: **Programação**) para abrir uma conversa já preparada para aquele tipo de tarefa.
3. **(Opcional) Conecte o GitHub** em **Plugins → GitHub → Gerenciar** para acompanhar seus repositórios.

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

A barra lateral agrupa projetos e conversas por pasta.

- **Projetos separados** — cada pasta vira um grupo com seus próprios chats.
- **Chats por pasta** — as conversas de cada projeto ficam agrupadas.
- **Nova sessão** — cria um novo chat. O botão **+** ao lado de cada pasta inicia a conversa naquele projeto.
- **Buscar sessões** — encontra uma conversa rapidamente.

A barra lateral fica **ativa por padrão** e pode ser recolhida ou expandida pelo botão **"Alternar barra lateral"**.

### 📚 Biblioteca

**Biblioteca** abre uma página do aplicativo com abas de imagens, documentos, vídeos e áudios. A grade exibe até 12 itens por página. Você pode visualizar imagens, importar e baixar arquivos, e usar **Mostrar na conversa** nos itens vinculados ao histórico. Os documentos criados em uma pasta de projeto podem ser localizados pelo Explorer.

### Plugins, skills e ferramentas

Abra **Plugins** na barra lateral. Os cartões exibem o status da conexão, como **Conectado** ou **Login pendente**.

- **GitHub** permite consultar repositórios com a IA e abrir o site dentro do app ou no seu navegador.
- **Microsoft Learn** traz documentação oficial de Windows, .NET e Azure. **Playwright** aparece como conectado quando seu servidor MCP está configurado.
- **Supabase** pode ser conectado a um projeto para consultar a base de dados em modo de leitura.
- Em **Skills**, você pode instalar guias como Superpowers, Ponytail e Frontend Design. Em **Ferramentas**, é possível instalar ou abrir o Cloudflare One Client.

### Voz na nuvem ou no computador

O microfone preenche o campo de texto com o ditado. O botão de conversa por voz permite falar com a IA e ouvir a resposta. A configuração de voz separa o modo **Nuvem** do modo **Local**.

Para usar o modo local, vá a **Plugins → VoiceStudio → Instalar**. O OpenCode baixa e verifica o instalador oficial. Na primeira abertura, o estúdio ajuda a preparar os modelos de voz. Reserve cerca de 10 GB e considere que o processamento local usa recursos do seu computador.

O **VoiceStudio** na barra lateral abre o estúdio para gravar, criar vozes e dublar. Em **Plugins → VoiceStudio → Configurar**, você pode testar a voz e escolher **Usar no OpenCode**.

### Atualizações do fork

1. Abra **Verificar atualizações** na barra lateral.
2. Quando aparecer **Atualizar para**, clique no botão.
3. A partir da versão **0.3.0**, o OpenCode baixa e verifica o pacote, instala e reabre no mesmo local. Seu perfil, suas conversas e pastas de projeto são preservados.

Se estiver usando a **0.2.2**, o botão aparece como **Baixar atualização** seguido do número da versão. O aplicativo pede onde salvar o instalador e depois oferece **Instalar e reabrir**. A partir da 0.3.0, o aplicativo usa o pacote interno **OpenCode-Infinite-PTBR-Update.zip**.

### 🐙 GitHub

Abra **Plugins → GitHub → Gerenciar** para acessar seus repositórios.

- **Conectar Git do Windows** — autoriza as operações do Git e guarda a credencial no Gerenciador de Credenciais do Windows.
- **Entrar no GitHub dentro do OpenCode** — abre a janela de navegação do aplicativo. Entre uma vez nessa janela para gravar a sessão no perfil do OpenCode. O painel mostra a sessão web e o Git do Windows separadamente.
- **Entrar com Google no navegador padrão** abre a página oficial do GitHub no perfil habitual do navegador. Lá, escolha **Continuar com Google**. A sessão criada nesse fluxo fica no navegador.
- **Acompanhar com a IA** — pede um resumo de issues, pull requests e execuções do repositório.
- **Preparar envio com a IA** — a IA confere as alterações e prepara o envio (commit/push), pedindo a sua confirmação antes de qualquer mudança.
- **Configurar leitura da IA** — cola um token de leitura para a IA consultar o repositório (veja abaixo).

> A conexão do Git do Windows precisa do **Git for Windows** instalado. Baixe em <https://git-scm.com/download/win>.

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

**"Como envio um relatório de erro?"**
Depois que o erro aparecer, clique em **Exportar relatório de erro** na barra lateral e escolha onde salvar o arquivo `.txt`. O relatório inclui a versão, o modo de conexão, os prazos de cota disponíveis e categorias dos eventos recentes. O app gera esse resumo sem copiar as chaves, tokens ou o texto das conversas dos logs. Se o app mostrar uma tela de falha, use **Exportar logs**.

**"O Windows bloqueou o instalador."**
O instalador desta versão é distribuído sem assinatura digital. Confira se você baixou pela página oficial do projeto e compare o arquivo com o SHA-256 publicado na release.

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

## Próximas versões

- Adição de modelos de IA locais, com instalação opcional.
