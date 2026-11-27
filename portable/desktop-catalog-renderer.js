function portableCatalogButton(text, action, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (primary) button.className = "plugins-primary";
  button.addEventListener("click", action);
  return button;
}

function portableCatalogConnectionLabel(status) {
  return ({
    connected: "Conectado", needs_auth: "Login pendente",
    needs_client_registration: "Configuração de login pendente", failed: "Falha na conexão",
    disabled: "Desativado", not_configured: "Não configurado",
    unavailable: "Status indisponível", checking: "Verificando…",
  })[status] ?? "Status indisponível";
}

function portableCatalogCard(name, description, icon, kind, keyword = "") {
  const element = document.createElement("article");
  element.className = "plugins-entry";
  element.hidden = true;
  element.dataset.catalogEntry = "";
  const mark = document.createElement("div");
  mark.className = "plugins-icon plugins-letter";
  mark.setAttribute("aria-hidden", "true");
  if (Object.hasOwn(portableCatalogLogos, icon)) {
    const image = document.createElement("img");
    image.src = portableCatalogLogos[icon];
    image.alt = "";
    mark.classList.add("plugins-brand");
    mark.append(image);
  } else mark.textContent = icon;
  const body = document.createElement("div");
  const title = document.createElement("h4");
  title.textContent = name;
  const info = document.createElement("p");
  info.className = "plugins-muted";
  info.textContent = description;
  const meta = document.createElement("p");
  meta.className = "plugins-muted plugins-meta";
  meta.textContent = kind;
  const actions = document.createElement("div");
  actions.className = "plugins-actions";
  body.append(title, info, meta);
  element.append(mark, body, actions);
  return {element, body, meta, actions, kind, keywords: [name, description, kind, keyword].join(" ")};
}

function portableSupabaseDialog(panel, api, status, onClose) {
  if (panel.querySelector("dialog.plugins-connection[open]")) return;
  const dialog = document.createElement("dialog");
  dialog.className = "plugins-connection";
  dialog.setAttribute("aria-labelledby", "plugins-supabase-title");
  dialog.innerHTML = `
    <h3 id="plugins-supabase-title">Conectar ao Supabase</h3>
    <p class="plugins-muted">Use o login do Supabase para autorizar o OpenCode. A configuração deste painel permite consultar o projeto em modo de leitura.</p>
    <form>
      <label>Referência do projeto
        <input name="project" type="text" pattern="[a-z0-9]{20}" maxlength="20" spellcheck="false" autocomplete="off" placeholder="Referência de 20 caracteres">
      </label>
      <p class="plugins-muted">Encontre a referência em Configurações do projeto, na página Geral do Supabase.</p>
      <p class="plugins-muted" role="status"></p>
      <div class="plugins-actions">
        <button type="submit" class="plugins-primary" data-connect>Entrar no navegador</button>
        <button type="button" data-logout hidden>Desconectar conta</button>
        <button type="button" data-dismiss>Fechar</button>
      </div>
    </form>`;
  const form = dialog.querySelector("form");
  const input = form.elements.project;
  const connect = form.querySelector("[data-connect]");
  const logout = form.querySelector("[data-logout]");
  const dismiss = form.querySelector("[data-dismiss]");
  const message = form.querySelector("[role=status]");
  let busy = false;
  let connected = status === "connected";
  input.required = ["not_configured", "unavailable"].includes(status);

  function update() {
    connect.hidden = connected;
    logout.hidden = !connected;
    connect.disabled = logout.disabled = input.disabled = busy || connected;
    if (connected) logout.disabled = busy;
    dismiss.textContent = busy ? "Cancelar autorização" : "Fechar";
  }
  if (connected) message.textContent = "Conta conectada.";
  update();
  panel.append(dialog);
  dialog.showModal();
  dismiss.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (busy && !connected) void api.supabaseCancel().catch(() => {});
    dialog.remove();
    onClose();
  }, {once: true});
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || connected) return;
    const ref = input.value.trim();
    busy = true;
    update();
    message.textContent = "Conclua a autorização no navegador.";
    try {
      const result = await api.supabaseConnect(ref);
      if (!dialog.open) return;
      connected = result === "connected";
      message.textContent = ({
        connected: "Supabase conectado.",
        cancelled: "Autorização cancelada. Você pode tentar novamente.",
        invalid: "Use a referência de 20 caracteres do projeto.",
        config_failed: "Não foi possível salvar o conector Supabase.",
        busy: "Já existe uma autorização em andamento.",
      })[result] ?? "Não foi possível concluir o login. Confira a conta e tente novamente.";
    } catch {
      if (dialog.open) message.textContent = "Não foi possível abrir a autorização.";
    } finally {
      busy = false;
      update();
      onClose();
    }
  });
  logout.addEventListener("click", async () => {
    busy = true;
    update();
    try {
      if (!await api.supabaseLogout()) throw new Error();
      connected = false;
      input.required = false;
      message.textContent = "Conta desconectada.";
    } catch { message.textContent = "Não foi possível desconectar a conta."; }
    finally { busy = false; update(); onClose(); }
  });
}

function portableCatalogSkills(cards, api, feedback, refresh) {
  return cards.map(pack => {
    const complete = pack.installed === pack.skills.length;
    const card = portableCatalogCard(pack.name, pack.description, "✦", "Skill", pack.skills.join(" "));
    card.element.dataset.skillPack = pack.id;
    card.meta.textContent = complete ? "Instalada para todos os projetos"
      : pack.installed ? "Instalação parcial" : "Disponível";
    if (pack.skills.length > 1) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = pack.skills.length + " skills no pacote";
      const names = document.createElement("p");
      names.className = "plugins-muted";
      names.textContent = pack.skills.map(name => "@" + name).join(" · ");
      details.append(summary, names);
      card.body.append(details);
    }
    if (complete) {
      card.actions.append(portableCatalogButton("Copiar comando", async () => {
        try {
          await navigator.clipboard.writeText("@" + pack.entry);
          feedback("Cole @" + pack.entry + " na sua mensagem.");
        } catch { feedback("Use @" + pack.entry + " na sua mensagem."); }
      }));
    } else {
      const install = portableCatalogButton("Instalar", async () => {
        install.disabled = true;
        feedback("Instalando " + pack.name + "…");
        try {
          if (!await api.installSkill(pack.id)) throw new Error();
          await refresh(pack.id);
          feedback(pack.name + " disponível no chat. Use @" + pack.entry + ".");
        } catch {
          feedback("Não foi possível instalar " + pack.name + ". Tente novamente.");
          install.disabled = false;
        }
      }, true);
      card.actions.append(install);
    }
    return {...card, installed: complete};
  });
}
