const portableGithubModel = { providerID: "opencode", modelID: "deepseek-v4.1-flash-free" };

function portableGithubInstall(layout, global, tabs, getSession, getTab, registry, dialog) {
  const github = window.electron?.portableGithub;
  if (!github) return null;

  const panel = document.createElement("div");
  panel.className = "portable-github-panel";
  const dialogId = "portable-github";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const agentStatus = document.createElement("p");
  agentStatus.setAttribute("role", "status");
  const destination = document.createElement("p");
  const login = document.createElement("button");
  login.type = "button";
  login.textContent = "Conectar Git do Windows";
  const cancelLogin = document.createElement("button");
  cancelLogin.type = "button";
  cancelLogin.textContent = "Cancelar tentativa";
  cancelLogin.hidden = true;
  const loginStatus = document.createElement("p");
  loginStatus.className = "portable-github-login-status";
  loginStatus.setAttribute("role", "status");
  loginStatus.hidden = true;
  const open = document.createElement("button");
  open.type = "button";
  open.textContent = "Abrir aba do GitHub";
  const external = document.createElement("button");
  external.type = "button";
  external.textContent = "Abrir no navegador padrão";
  const google = document.createElement("button");
  google.type = "button";
  google.textContent = "Entrar com Google no navegador padrão";
  const webStatus = document.createElement("p");
  webStatus.setAttribute("role", "status");
  const monitor = document.createElement("button");
  monitor.type = "button";
  monitor.textContent = "Acompanhar com a IA";
  const configure = document.createElement("button");
  configure.type = "button";
  configure.textContent = "Configurar leitura da IA";
  const publish = document.createElement("button");
  publish.type = "button";
  publish.textContent = "Preparar envio com a IA";
  publish.className = "portable-github-primary";
  let current;
  let waitingForLogin = false;
  let loginSequence = 0;
  let opened = false;

  function showLoginStatus(message, waiting) {
    waitingForLogin = waiting;
    login.textContent = waiting ? "Tentar novamente" : "Conectar Git do Windows";
    cancelLogin.hidden = !waiting;
    loginStatus.textContent = message;
    loginStatus.hidden = !message;
  }

  function project() {
    const route = layout.route();
    const selection = layout.home.selection();
    const tab = getTab();
    const session = getSession();
    const directory = route.type === "session" ? session?.location.directory
      : route.type === "draft" ? tab?.directory : selection.directory;
    const key = route.type === "session" ? route.server : route.type === "draft" ? tab?.server : selection.server;
    const localUrl = registry.ownUrl();
    if (!localUrl) return;
    const connections = global.servers.list();
    const connection = key ? connections.find(server => MB.key(server) === key)
      : connections.find(server => MB.local(server, localUrl));
    if (!connection || !MB.local(connection, localUrl)) return;
    const server = MB.key(connection);
    return {
      server,
      directory: directory ?? global.serverCtx(server)?.projects.last()?.worktree,
    };
  }

  async function refresh() {
    current = undefined;
    const active = project();
    status.textContent = "Verificando a conexão…";
    destination.textContent = "";
    publish.disabled = true;
    open.disabled = false;
    monitor.disabled = !active?.directory;
    try {
      const result = await github.status(active?.directory);
      status.textContent = !result?.credentialStatusAvailable
        ? "Não foi possível consultar o Gerenciador de Credenciais do Windows."
        : result.hasSavedAccount ? "Git do Windows: conta salva." : "Git do Windows: nenhuma conta salva.";
      agentStatus.textContent = "Acesso da IA · " + ({
        connected: "Conectado", failed: "Falha na conexão", needs_auth: "Login pendente",
        disabled: "Desativado", not_configured: "Não configurado",
      }[result?.mcpStatus] ?? "Status indisponível");
      configure.hidden = result?.mcpStatus === "connected";
      webStatus.textContent = result?.webSignedIn === true ? "Janela interna: sessão do GitHub salva neste perfil."
        : result?.webSignedIn === false ? "Janela interna: entre uma vez com sua conta do GitHub para abrir seus repositórios aqui."
        : "Navegador do OpenCode: não foi possível verificar a sessão.";
      open.textContent = result?.webSignedIn === false ? "Entrar no GitHub dentro do OpenCode" : "Abrir GitHub no OpenCode";
      open.dataset.signIn = String(result?.webSignedIn === false);
      if (!active?.directory) destination.textContent = "Escolha um projeto.";
      else if (!result?.isGit) destination.textContent = "Este projeto ainda não é um repositório Git.";
      else if (!result.repository) destination.textContent = "O remoto origin deste projeto ainda não aponta para o GitHub.";
      else {
        destination.textContent = result.repository + (result.branch ? " · " + result.branch : "");
        current = { ...active, repository: result.repository, branch: result.branch };
        publish.disabled = !result.branch;
      }
    } catch (error) {
      console.error("[portable-github]", error);
      status.textContent = "Não foi possível consultar o Git do Windows.";
    }
  }

  const show = () => {
    if (opened) return;
    opened = true;
    void dialog.show(() => I(OV, { title: "GitHub", fit: true, children: panel }), () => {
      opened = false;
    }, dialogId);
    void refresh();
  };
  document.addEventListener("portable-github-open", show);
  F(() => document.removeEventListener("portable-github-open", show));
  configure.addEventListener("click", async () => {
    try {
      if (await github.configureReader()) dialog.close(dialogId);
      else status.textContent = "Não foi possível abrir a configuração de leitura.";
    } catch {
      status.textContent = "Não foi possível abrir a configuração de leitura.";
    }
  });
  login.addEventListener("click", async () => {
    const attempt = ++loginSequence;
    try {
      if (waitingForLogin) {
        login.disabled = true;
        cancelLogin.disabled = true;
        await github.cancelLogin();
        if (attempt !== loginSequence) return;
      }
      login.disabled = false;
      cancelLogin.disabled = false;
      showLoginStatus("Aguardando autorização no navegador. Se você o fechou, tente novamente ou cancele.", true);
      const result = await github.login();
      if (attempt !== loginSequence) return;
      const messages = {
        authorized: "Autorização do GitHub concluída.",
        cancelled: "Tentativa cancelada. Você pode conectar novamente.",
        timeout: "A autorização expirou. Você pode conectar novamente.",
        busy: "Já há uma tentativa em outra janela do OpenCode.",
        failed: "A autorização não foi concluída. Você pode tentar novamente.",
      };
      showLoginStatus(messages[result] ?? messages.failed, false);
      if (result === "authorized") {
        await refresh();
        document.dispatchEvent(new Event("portable-github-changed"));
      }
    } catch {
      if (attempt === loginSequence) showLoginStatus("Não foi possível iniciar a autorização.", false);
    } finally {
      if (attempt === loginSequence) {
        login.disabled = false;
        cancelLogin.disabled = false;
      }
    }
  });
  cancelLogin.addEventListener("click", async () => {
    const attempt = ++loginSequence;
    login.disabled = true;
    cancelLogin.disabled = true;
    try {
      const cancelled = await github.cancelLogin();
      if (attempt !== loginSequence) return;
      showLoginStatus(cancelled
        ? "Tentativa cancelada. Você pode conectar novamente."
        : "A tentativa já terminou. Você pode conectar novamente.", false);
    } catch {
      if (attempt === loginSequence) showLoginStatus("Não foi possível cancelar a tentativa.", waitingForLogin);
    } finally {
      if (attempt === loginSequence) {
        login.disabled = false;
        cancelLogin.disabled = false;
      }
    }
  });
  open.addEventListener("click", async () => {
    open.disabled = true;
    try {
      if (await github.openWeb(current?.repository, open.dataset.signIn === "true")) dialog.close(dialogId);
      else webStatus.textContent = "Não foi possível abrir o GitHub no OpenCode.";
    } catch {
      webStatus.textContent = "Não foi possível abrir o GitHub no OpenCode.";
    } finally { open.disabled = false; }
  });
  const openInBrowser = async signIn => {
    if (!await github.openWeb(current?.repository, signIn, true).catch(() => false)) {
      webStatus.textContent = "Não foi possível abrir o navegador padrão.";
    }
  };
  external.addEventListener("click", () => void openInBrowser(false));
  google.addEventListener("click", () => void openInBrowser(true));
  monitor.addEventListener("click", async () => {
    const active = project();
    if (!active?.directory) return;
    const target = current?.repository ?? "[diga qual repositório do GitHub consultar]";
    monitor.disabled = true;
    try {
      await tabs.newDraft({ server: active.server, directory: active.directory },
        "Quero acompanhar o GitHub em " + target + ". Consulte issues, pull requests e as últimas execuções do Actions. " +
        "Use a integração GitHub de leitura quando disponível. Faça um resumo em português do Brasil com links e próximos passos.",
        portableGithubModel);
      dialog.close(dialogId);
    } catch (error) {
      console.error("[portable-github]", error);
      status.textContent = "Não foi possível preparar a consulta.";
    } finally {
      monitor.disabled = false;
    }
  });
  publish.addEventListener("click", async () => {
    if (!current) return;
    const { directory, server, repository, branch } = current;
    publish.disabled = true;
    try {
      await tabs.newDraft({ server, directory },
        "Quero publicar o projeto deste diretório no remoto GitHub origin (" + repository +
        "), na branch " + branch + ". Confira o status, o destino e os commits que seriam enviados. " +
        "Mostre um resumo e peça confirmação antes de fazer commit ou push. " +
        "Preserve minhas alterações, nunca force o push e deixe arquivos com chaves ou credenciais de fora.",
        portableGithubModel);
      dialog.close(dialogId);
    } catch (error) {
      console.error("[portable-github]", error);
      status.textContent = "Não foi possível preparar o envio.";
    } finally {
      publish.disabled = false;
    }
  });

  const style = document.createElement("style");
  style.textContent = portableGithubStyles;
  panel.append(status, agentStatus, destination, login, cancelLogin, loginStatus, webStatus, open, google, external, monitor, configure, publish);
  return style;
}
