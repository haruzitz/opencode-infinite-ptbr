let portableGithubBrowse;
const portableGithubModel = { providerID: "opencode", modelID: "deepseek-v4.1-flash-free" };

function portableGithubButton(layout, global, tabs, getSession, getTab, registry, platform, dialog) {
  const github = window.electron?.portableGithub;
  if (!github) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "portable-github";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "portable-github-toggle";
  toggle.title = "GitHub";
  toggle.setAttribute("aria-label", "GitHub");
  toggle.setAttribute("aria-expanded", "false");
  V(toggle, I(SV, { name: "github" }));

  const panel = document.createElement("div");
  panel.className = "portable-github-panel";
  const dialogId = "portable-github";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const destination = document.createElement("p");
  const login = document.createElement("button");
  login.type = "button";
  login.textContent = "Conectar conta";
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

  function showLoginStatus(message, waiting) {
    waitingForLogin = waiting;
    login.textContent = waiting ? "Tentar novamente" : "Conectar conta";
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
    open.disabled = !active?.directory;
    monitor.disabled = !active?.directory;
    try {
      const result = await github.status(active?.directory);
      status.textContent = result?.hasSavedAccount
        ? "O Git do Windows já tem uma conta salva."
        : "Nenhuma conta do GitHub está salva no Git do Windows.";
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

  toggle.addEventListener("click", () => {
    toggle.setAttribute("aria-expanded", "true");
    void dialog.show(() => I(OV, { title: "GitHub", fit: true, children: panel }), () => {
      toggle.setAttribute("aria-expanded", "false");
    }, dialogId);
    void refresh();
  });
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
      if (result === "authorized") await refresh();
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
    const active = project();
    if (!active?.directory) return;
    const context = global.serverCtx(active.server);
    if (!context) return;
    const url = current ? "https://github.com/" + current.repository : "https://github.com/";
    open.disabled = true;
    status.textContent = "Abrindo o GitHub no navegador do OpenCode…";
    try {
      let session = layout.route().type === "session" ? getSession() : undefined;
      if (!session) {
        session = context.data.session.list().find(item =>
          item.title === "GitHub" && item.location.directory === active.directory);
        if (!session) {
          session = await context.data.session.create({
            title: "GitHub",
            location: { directory: active.directory },
            model: { providerID: portableGithubModel.providerID, id: portableGithubModel.modelID },
          }).request;
        }
        tabs.select(tabs.addSessionTab({ server: active.server, sessionId: session.id }));
      }

      for (let attempt = 0; attempt < 32; attempt++) {
        if (portableGithubBrowse?.(session.id, url)) {
          dialog.close(dialogId);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      status.textContent = "Navegador indisponível nesta janela. Amplie a janela ou abra no navegador padrão.";
      const fallback = document.createElement("button");
      fallback.type = "button";
      fallback.textContent = "Abrir no navegador padrão ↗";
      fallback.addEventListener("click", () => platform.openExternal(url));
      if (!panel.querySelector("[data-github-fallback]")) {
        fallback.dataset.githubFallback = "";
        panel.append(fallback);
      }
    } catch (error) {
      console.error("[portable-github]", error);
      status.textContent = "Não foi possível abrir a aba do GitHub.";
    } finally {
      open.disabled = false;
    }
  });
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
  panel.append(status, destination, login, cancelLogin, loginStatus, open, monitor, configure, publish);
  wrapper.append(style, toggle);
  return wrapper;
}
