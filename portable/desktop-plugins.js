function portablePlugins(trigger) {
  const host = document.querySelector("[data-portable-library-host]");
  if (!host) return;
  const existing = host.querySelector("[data-portable-plugins-page]");
  if (existing) { existing.querySelector("h2").focus(); return; }
  portableDismissToolPage(host);

  const api = window.electron?.portableVoice;
  const catalog = window.electron?.portableCatalog;
  const panel = document.createElement("section");
  panel.dataset.portablePluginsPage = "";
  panel.setAttribute("aria-labelledby", "portable-plugins-title");
  panel.innerHTML = `
    <style>
      [data-portable-plugins-page] {
        --plugin-base:var(--v2-surface-surface-base,#171922);
        --plugin-raised:var(--v2-surface-surface-raised,#202331);
        --plugin-text:var(--v2-text-text-base,#f1f2f8);
        --plugin-muted:var(--v2-text-text-muted,#afb5cc);
        --plugin-border:var(--v2-border-border-muted,#45495f);
        position:absolute; inset:0; z-index:10; overflow:auto; overscroll-behavior:contain;
        background:var(--plugin-base); color:var(--plugin-text); padding:clamp(20px,4vw,58px);
        -webkit-app-region:no-drag;
      }
      [data-portable-plugins-page] [hidden] { display:none !important; }
      [data-portable-plugins-nav][aria-current="page"] { background:var(--v2-surface-surface-raised,#272b40); color:var(--v2-text-text-base,#fff); }
      [data-portable-plugins-page] .plugins-shell { width:min(100%,960px); margin:auto; }
      [data-portable-plugins-page] .plugins-head, [data-portable-plugins-page] .plugins-tools {
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;
      }
      [data-portable-plugins-page] h2 { margin:0; font-size:clamp(26px,3.4vw,36px); line-height:1.16; font-weight:660; letter-spacing:-.035em; }
      [data-portable-plugins-page] h2:focus { outline:none; }
      [data-portable-plugins-page] h3 { margin:0 0 12px; font-size:16px; font-weight:650; }
      [data-portable-plugins-page] p { margin:0; }
      [data-portable-plugins-page] .plugins-subtitle { margin-top:8px; }
      [data-portable-plugins-page] .plugins-muted { color:var(--plugin-muted); font-size:13px; line-height:1.55; }
      [data-portable-plugins-page] .plugins-tools { margin:26px 0 24px; }
      [data-portable-plugins-page] .plugins-sections { display:flex; flex-wrap:wrap; gap:7px; margin-top:23px; padding-bottom:10px; border-bottom:1px solid var(--plugin-border); }
      [data-portable-plugins-page] .plugins-sections button { min-width:92px; }
      [data-portable-plugins-page] .plugins-search { position:relative; flex:1 1 220px; }
      [data-portable-plugins-page] .plugins-search::before {
        content:""; position:absolute; left:14px; top:14px; width:10px; height:10px; border:1.5px solid var(--plugin-muted); border-radius:50%; pointer-events:none;
      }
      [data-portable-plugins-page] .plugins-search::after {
        content:""; position:absolute; left:22px; top:23px; width:5px; height:1.5px; background:var(--plugin-muted); transform:rotate(45deg); pointer-events:none;
      }
      [data-portable-plugins-page] input, [data-portable-plugins-page] button {
        min-height:36px; padding:7px 12px; border:1px solid var(--plugin-border); border-radius:8px;
        color:var(--plugin-text); font:inherit; font-size:13px;
      }
      [data-portable-plugins-page] input { width:100%; min-height:42px; padding-inline-start:37px; background:var(--plugin-raised); }
      [data-portable-plugins-page] button { background:transparent; cursor:pointer; }
      [data-portable-plugins-page] button:hover:not(:disabled) { background:var(--plugin-raised); border-color:#7e8ac2; }
      [data-portable-plugins-page] button:focus-visible, [data-portable-plugins-page] input:focus-visible { outline:2px solid #8daaff; outline-offset:2px; }
      [data-portable-plugins-page] button:disabled { opacity:.55; cursor:default; }
      [data-portable-plugins-page] .plugins-filters { display:flex; gap:3px; padding:3px; border:1px solid var(--plugin-border); border-radius:10px; }
      [data-portable-plugins-page] .plugins-filters button { min-height:34px; border-color:transparent; }
      [data-portable-plugins-page] button[aria-pressed="true"] { background:var(--plugin-raised); border-color:var(--plugin-border); font-weight:600; }
      [data-portable-plugins-page] .plugins-group { margin-top:26px; }
      [data-portable-plugins-page] .plugins-empty { padding:12px 14px; border:1px dashed var(--plugin-border); border-radius:10px; }
      [data-portable-plugins-page] .plugins-entry {
        display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:14px; align-items:start;
        padding:16px; border:1px solid var(--plugin-border); border-radius:12px; background:var(--plugin-raised);
      }
      [data-portable-plugins-page] .plugins-entry:hover { border-color:#7e8ac2; }
      [data-portable-plugins-page] .plugins-entry + .plugins-entry { margin-top:8px; }
      [data-portable-plugins-page] .plugins-icon {
        display:flex; align-items:center; justify-content:center; gap:3px; width:42px; height:42px;
        border-radius:10px; color:#c2ceff; background:#343d69;
      }
      [data-portable-plugins-page] .plugins-icon.plugins-brand { background:#282c39; }
      [data-portable-plugins-page] .plugins-brand img { width:28px; height:28px; object-fit:contain; }
      [data-portable-plugins-page] .plugins-icon.plugins-letter { font-weight:680; font-size:19px; }
      [data-portable-plugins-page] .plugins-entry details { margin-top:8px; }
      [data-portable-plugins-page] summary { cursor:pointer; }
      [data-portable-plugins-page] h4 { margin:0 0 4px; font-size:16px; font-weight:650; }
      [data-portable-plugins-page] .plugins-entry .plugins-meta { margin-top:6px; }
      [data-portable-plugins-page] [data-connection="connected"] { color:var(--v2-text-text-success,#8ddcb2); }
      [data-portable-plugins-page] .plugins-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      [data-portable-plugins-page] button.plugins-primary { background:#435fc3; color:#fff; border-color:#657bce; }
      [data-portable-plugins-page] button.plugins-primary:hover:not(:disabled) { background:#4d68d0; }
      [data-portable-plugins-page] .plugins-feedback { margin-top:12px; }
      [data-portable-plugins-page] .plugins-feedback p:empty { display:none; }
      [data-portable-plugins-page] progress { width:min(100%,320px); height:10px; margin:8px 0 0; accent-color:#829cff; }
      [data-portable-plugins-page] .plugins-connection {
        position:fixed; inset:0; margin:auto; width:min(520px,calc(100vw - 28px)); max-height:90vh; padding:22px;
        color:var(--plugin-text); background:var(--plugin-base); border:1px solid var(--plugin-border); border-radius:12px;
      }
      [data-portable-plugins-page] .plugins-connection::backdrop { background:#080912b5; }
      [data-portable-plugins-page] .plugins-connection form { display:grid; gap:12px; margin-top:14px; }
      [data-portable-plugins-page] .plugins-connection input { padding:8px 10px; margin-top:5px; }
      @container (max-width:610px) {
        [data-portable-plugins-page] .plugins-entry .plugins-actions { grid-column:2/-1; }
      }
      [data-portable-plugins-page] .plugins-shell { container-type:inline-size; }
    </style>
    <div class="plugins-shell">
      <header class="plugins-head">
        <div>
          <h2 id="portable-plugins-title" tabindex="-1">Plugins</h2>
          <p class="plugins-muted plugins-subtitle" data-subtitle>Instale e gerencie ferramentas opcionais do OpenCode.</p>
        </div>
        <button type="button" data-back>Voltar à conversa</button>
      </header>
      <div class="plugins-sections" role="group" aria-label="Seções do catálogo">
        <button type="button" data-section="plugins" aria-pressed="true">Plugins</button>
        <button type="button" data-section="skills" aria-pressed="false">Skills</button>
        <button type="button" data-section="tools" aria-pressed="false">Ferramentas</button>
      </div>
      <div class="plugins-tools">
        <label class="plugins-search">
          <input type="search" placeholder="Buscar plugins" aria-label="Buscar plugins">
        </label>
        <div class="plugins-filters" role="group" aria-label="Filtrar plugins">
          <button type="button" data-filter="all" aria-pressed="true">Todos</button>
          <button type="button" data-filter="installed" aria-pressed="false">Instalados</button>
          <button type="button" data-filter="available" aria-pressed="false">Disponíveis</button>
        </div>
      </div>
      <section class="plugins-group" data-group="installed" aria-labelledby="portable-plugins-installed" hidden>
        <h3 id="portable-plugins-installed">Seus plugins</h3>
        <p data-empty class="plugins-muted plugins-empty">Nenhum plugin instalado.</p>
      </section>
      <section class="plugins-group" data-group="available" aria-labelledby="portable-plugins-available" hidden>
        <h3 id="portable-plugins-available">Disponíveis</h3>
        <p data-empty class="plugins-muted plugins-empty">Nenhum plugin disponível para instalar.</p>
      </section>
      <p data-no-results class="plugins-muted plugins-empty" role="status" hidden>Nenhum plugin encontrado.</p>
      <article class="plugins-entry" data-entry hidden>
        <div class="plugins-icon plugins-brand" aria-hidden="true"><img src="${portableCatalogLogos.voicestudio}" alt=""></div>
        <div>
          <h4>VoiceStudio</h4>
          <p class="plugins-muted">Transcreva, grave e gere voz no computador. Use suas vozes no OpenCode ou no estúdio.</p>
          <p class="plugins-muted plugins-meta" data-state></p>
        </div>
        <div class="plugins-actions">
          <button class="plugins-primary" type="button" data-install>Instalar</button>
          <button class="plugins-primary" type="button" data-open>Abrir estúdio</button>
          <button type="button" data-configure>Configurar</button>
        </div>
      </article>
      <div class="plugins-feedback" data-voice-feedback>
        <p class="plugins-muted" role="status"></p>
        <progress max="100" aria-label="Progresso da instalação do VoiceStudio" hidden></progress>
        <button type="button" data-retry hidden>Tentar novamente</button>
      </div>
      <div class="plugins-feedback" data-skill-feedback hidden>
        <p class="plugins-muted" role="status"></p>
        <button type="button" data-skill-retry hidden>Tentar novamente</button>
      </div>
      <div class="plugins-feedback" data-tool-feedback hidden>
        <p class="plugins-muted" role="status"></p>
        <progress max="100" aria-label="Progresso da instalação do Cloudflare WARP" hidden></progress>
      </div>
    </div>`;

  const get = selector => panel.querySelector(selector);
  const heading = get("h2");
  const search = get("input");
  const filters = [...panel.querySelectorAll("[data-filter]")];
  const sections = [...panel.querySelectorAll("[data-section]")];
  const installedGroup = get('[data-group="installed"]');
  const availableGroup = get('[data-group="available"]');
  const entry = get("[data-entry]");
  const stateLabel = get("[data-state]");
  const install = get("[data-install]");
  const open = get("[data-open]");
  const configure = get("[data-configure]");
  const status = get(".plugins-feedback [role=status]");
  const progress = get("progress");
  const retry = get("[data-retry]");
  const searchText = value => value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const keywords = searchText("VoiceStudio voice studio áudio local transcrição voz gravação dublagem narração estúdio");
  const lifecycle = new AbortController();
  let section = "plugins";
  let filter = "all";
  let state;
  let busy = false;
  let statusRequest = 0;
  let statusTimer;
  let unsubscribe;
  let skillCards;
  let skillRequest = 0;
  let loadingSkills = false;
  let connections = {};
  let connectionsRequest = 0;
  const github = portableCatalogCard("GitHub", "Conecte sua conta, acompanhe repositórios e prepare envios com a IA.", "github", "Conector", "git repositório");
  github.actions.append(portableCatalogButton("Gerenciar", () => document.dispatchEvent(new Event("portable-github-open")), true));
  const supabase = portableCatalogCard("Supabase", "Consulte seu banco de dados e a documentação pelo OpenCode.", "supabase", "Conector", "sql banco oauth mcp");
  const supabaseButton = portableCatalogButton("Configurar",
    () => portableSupabaseDialog(panel, catalog, connections.supabase, refreshConnections), true);
  supabase.actions.append(supabaseButton);
  const playwright = portableCatalogCard("Playwright", "Teste formulários e fluxos no navegador com a IA.", "playwright", "Navegador", "automação edge teste navegador");
  const microsoftLearn = portableCatalogCard("Microsoft Learn", "Consulte documentação oficial sobre Windows, .NET e Azure.", "microsoft-learn", "Documentação", "microsoft learn windows c# dotnet azure wpf");
  const connectors = {github, supabase, playwright, "microsoft-learn": microsoftLearn};
  for (const [name, card] of Object.entries(connectors)) {
    card.element.dataset.plugin = name;
    card.meta.setAttribute("role", "status");
  }
  const skillFeedback = get("[data-skill-feedback] [role=status]");
  const skillRetry = get("[data-skill-retry]");
  const toolFeedback = get("[data-tool-feedback] [role=status]");
  const warpProgress = get("[data-tool-feedback] progress");
  const warp = portableCatalogCard("Cloudflare One Client (WARP)",
    "Instale ou abra o cliente da Cloudflare para gerenciar a conexão de rede e o proxy local.", "cloudflare", "Rede · Windows", "cloudflare warp proxy");
  warp.element.dataset.tool = "warp";
  let warpInstalled;
  let warpActing = false;
  let warpStatusRequest = 0;
  let warpTimer;
  const warpButton = portableCatalogButton("Abrir cliente", async () => {
    const installing = !warpInstalled;
    warpActing = true;
    warpButton.disabled = true;
    if (installing) {
      toolFeedback.textContent = "Preparando o download da Cloudflare…";
      warpProgress.hidden = false;
      warpProgress.removeAttribute("value");
    }
    let outcome;
    try {
      outcome = await catalog.warpAction(installing ? "install" : "open");
    } catch { outcome = "failed"; }
    warpActing = false;
    if (!panel.isConnected) return;
    warpProgress.hidden = true;
    await refreshWarp();
    if (outcome === "installed" && section === "tools" && filter === "available") {
      filter = "installed";
      render();
    }
    toolFeedback.textContent = ({
      installed: "Cloudflare One Client instalado. Clique em Abrir cliente para configurar.",
      opened: "Cloudflare One Client aberto.",
      missing: "O cliente não está mais instalado. Você pode instalá-lo por aqui.",
      download_failed: "Não foi possível baixar o instalador da Cloudflare. Tente novamente.",
      signature_failed: "A assinatura do instalador não pôde ser validada.",
      cancelled: "Instalação cancelada na confirmação do Windows.",
      windows_busy: "O Windows está executando outra instalação. Tente novamente quando ela terminar.",
      reboot_required: "Instalação concluída. Reinicie o Windows para finalizar.",
    })[outcome] ?? (installing ? "O Windows não concluiu a instalação do Cloudflare One Client." : "Não foi possível abrir o Cloudflare One Client.");
  }, true);
  warp.actions.append(warpButton);

  async function refreshWarp() {
    const request = ++warpStatusRequest;
    const checking = warpInstalled === undefined;
    const following = warpTimer !== undefined;
    if (checking) toolFeedback.textContent = "Verificando a instalação do Cloudflare One Client…";
    clearTimeout(warpTimer);
    warpTimer = undefined;
    try {
      const current = await catalog.warpStatus();
      if (!panel.isConnected || request !== warpStatusRequest) return;
      warpInstalled = current.installed;
      warp.meta.textContent = warpInstalled ? "Rede · Instalado no Windows" : "Rede · Disponível para Windows";
      warpButton.textContent = warpInstalled ? "Abrir cliente" : "Instalar";
      warpButton.disabled = warpActing || current.installing;
      if (checking) toolFeedback.textContent = "";
      if (!warpActing) {
        if (current.installing) {
          if (warpProgress.hidden || !toolFeedback.textContent) toolFeedback.textContent = "Instalação em andamento…";
          warpTimer = setTimeout(() => void refreshWarp(), 1200);
        } else if (following) {
          toolFeedback.textContent = warpInstalled ? "Cloudflare One Client instalado." : "A instalação terminou. Confira o estado do cliente.";
        }
        warpProgress.hidden = !current.installing;
      }
      render();
    } catch {
      if (!panel.isConnected || request !== warpStatusRequest) return;
      warpButton.disabled = warpActing;
      toolFeedback.textContent = "Não foi possível verificar a instalação.";
    }
  }

  const unsubscribeWarp = catalog?.warpProgress(({phase, percent}) => {
    warpProgress.hidden = false;
    if (phase === "download" && Number.isFinite(percent)) warpProgress.value = percent;
    else warpProgress.removeAttribute("value");
    if (phase === "download") toolFeedback.textContent = "Baixando o Cloudflare WARP…" + (Number.isFinite(percent) ? " " + percent + "%" : "");
    if (phase === "verify") toolFeedback.textContent = "Verificando a assinatura do instalador…";
    if (phase === "install") toolFeedback.textContent = "Confirme a instalação no Windows quando solicitado.";
  });

  const sectionCopy = {
    plugins: {installed: "Seus plugins", singular: "plugin", plural: "plugins", subtitle: "Instale e gerencie ferramentas opcionais do OpenCode."},
    skills: {installed: "Suas skills", singular: "skill", plural: "skills", subtitle: "Instale instruções que o OpenCode pode usar em todos os seus projetos."},
    tools: {installed: "Ferramentas instaladas", singular: "ferramenta", plural: "ferramentas", subtitle: "Acesse aplicativos externos pelo OpenCode."},
  };

  async function refreshConnections() {
    const request = ++connectionsRequest;
    const current = await catalog?.mcpStatuses().catch(() => null);
    if (!panel.isConnected || request !== connectionsRequest) return;
    connections = current ?? Object.fromEntries(Object.keys(connectors).map(name => [name, "unavailable"]));
    render();
  }

  async function loadSkills(focus) {
    if (loadingSkills && !focus) return;
    const request = ++skillRequest;
    loadingSkills = true;
    skillRetry.hidden = true;
    if (!focus) skillFeedback.textContent = "Consultando skills…";
    try {
      const entries = await catalog.skills();
      if (!panel.isConnected || request !== skillRequest) return;
      const restored = focus && document.activeElement?.closest("[data-skill-pack]")?.dataset.skillPack === focus;
      for (const card of skillCards ?? []) card.element.remove();
      skillCards = portableCatalogSkills(entries, catalog, text => {skillFeedback.textContent = text;}, loadSkills);
      if (focus && section === "skills" && filter === "available") filter = "installed";
      if (!focus) skillFeedback.textContent = "";
      render();
      if (restored) skillCards.find(card => card.element.dataset.skillPack === focus)?.actions.querySelector("button")?.focus();
    } catch {
      if (request !== skillRequest) return;
      skillFeedback.textContent = "Não foi possível consultar as skills.";
      skillRetry.hidden = false;
      if (focus) throw new Error("Consulta às skills falhou");
    } finally { if (request === skillRequest) loadingSkills = false; }
  }

  function render() {
    const installed = !!state?.installed && !state.installing;
    const installing = !!state?.installing;
    const plugins = Object.entries(connectors).map(([name, card]) => {
      const state = connections[name] ?? "checking";
      card.meta.dataset.connection = state;
      card.meta.textContent = card.kind + " · " + portableCatalogConnectionLabel(state);
      return {...card, installed: name === "github" || !["not_configured", "unavailable"].includes(state)};
    });
    supabaseButton.textContent = connections.supabase === "connected" ? "Gerenciar" : "Configurar";
    if (state) plugins.push({element: entry, keywords, installed});
    const tools = warpInstalled === undefined ? undefined : [{...warp, installed: warpInstalled}];
    const cards = {plugins, skills: skillCards, tools}[section];
    const copy = sectionCopy[section];
    const feminine = section !== "plugins";
    const query = searchText(search.value);
    const visible = (cards ?? []).filter(card => searchText(card.keywords).includes(query)
      && (filter === "all" || (filter === "installed") === card.installed));
    const shown = new Set(visible.map(card => card.element));
    for (const element of [entry, ...plugins.map(card => card.element), warp.element, ...(skillCards ?? []).map(card => card.element)]) element.hidden = !shown.has(element);
    for (const group of [installedGroup, availableGroup]) {
      const isInstalled = group === installedGroup;
      const results = visible.filter(card => card.installed === isInstalled);
      for (const {element} of results) if (element.parentElement !== group) group.append(element);
      group.hidden = !cards || (query ? results.length === 0 : filter !== "all" && (filter === "installed") !== isInstalled);
      const empty = group.querySelector("[data-empty]");
      empty.hidden = results.length > 0;
      const none = (feminine ? "Nenhuma " : "Nenhum ") + copy.singular;
      empty.textContent = isInstalled ? none + (feminine ? " instalada." : " instalado.") : none + " disponível para instalar.";
    }
    installedGroup.querySelector("h3").textContent = copy.installed;
    get("[data-no-results]").hidden = !query || !cards?.length || visible.length > 0;
    get("[data-no-results]").textContent = (feminine ? "Nenhuma " : "Nenhum ") + copy.singular + (feminine ? " encontrada." : " encontrado.");
    search.placeholder = "Buscar " + copy.plural;
    search.setAttribute("aria-label", search.placeholder);
    get("[data-subtitle]").textContent = copy.subtitle;
    get("[data-voice-feedback]").hidden = section !== "plugins";
    get("[data-skill-feedback]").hidden = section !== "skills";
    get("[data-tool-feedback]").hidden = section !== "tools";
    for (const button of sections) button.setAttribute("aria-pressed", String(button.dataset.section === section));
    stateLabel.textContent = installed
      ? "Áudio local · Instalado" + (["ready", "prepared"].includes(state.fast) ? " · Voz rápida preparada" : "")
      : "Áudio local · Requer cerca de 10 GB livres";
    install.hidden = !!installed;
    open.hidden = configure.hidden = !installed;
    install.disabled = open.disabled = configure.disabled = busy || installing;
    install.textContent = installing || (busy && !installed) ? "Instalando…" : "Instalar";
    for (const button of filters) button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  }

  async function refresh(announce = false) {
    const request = ++statusRequest;
    try {
      const current = await api?.studioStatus();
      if (!panel.isConnected || request !== statusRequest) return;
      if (!current) throw new Error();
      state = current;
      retry.hidden = true;
      if (current.installing && !busy) {
        status.textContent = "Instalação em andamento…";
        progress.hidden = false;
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => void refresh(true), 1000);
      } else if (announce && !busy) {
        progress.hidden = true;
        status.textContent = "";
      }
    } catch {
      if (!panel.isConnected || request !== statusRequest) return;
      if (!busy) status.textContent = "Não foi possível consultar os plugins.";
      progress.hidden = true;
      retry.hidden = false;
    }
    render();
  }

  async function run(shouldInstall) {
    if (busy || state?.installing) return;
    const restoreActionFocus = shouldInstall && document.activeElement === install;
    busy = true;
    render();
    status.textContent = shouldInstall ? "Preparando a instalação…" : "Abrindo o estúdio…";
    if (shouldInstall) {
      progress.hidden = false;
      progress.removeAttribute("value");
    }
    try {
      const result = await (shouldInstall ? api.studioInstall() : api.studioOpen());
      if (!panel.isConnected) return;
      status.textContent = result?.opened
        ? (shouldInstall ? "VoiceStudio instalado. Conclua a primeira configuração no estúdio." : "VoiceStudio aberto.")
        : "Não foi possível abrir o VoiceStudio.";
    } catch (error) {
      if (panel.isConnected) status.textContent = error?.message?.split("Error: ").pop() || "Não foi possível concluir a ação. Tente novamente.";
    } finally {
      if (panel.isConnected) {
        progress.hidden = true;
        await refresh();
        busy = false;
        if (shouldInstall && state?.installed && section === "plugins" && filter === "available") filter = "installed";
        render();
        if (restoreActionFocus && !entry.hidden) (state?.installed ? open : install).focus();
      }
    }
  }

  function leave(restoreFocus = true) {
    lifecycle.abort();
    clearTimeout(statusTimer);
    clearTimeout(warpTimer);
    unsubscribe?.();
    unsubscribeWarp?.();
    panel.querySelector("dialog[open]")?.close();
    unmount();
    trigger.removeAttribute("aria-current");
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }

  get("[data-back]").addEventListener("click", () => leave());
  panel.addEventListener("portable-page-dismiss", () => leave(false), {once: true});
  window.addEventListener("focus", () => {
    if (section === "tools") void refreshWarp();
    if (section === "plugins") void refreshConnections();
  }, {signal: lifecycle.signal});
  document.addEventListener("portable-github-changed", refreshConnections, {signal: lifecycle.signal});
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.stopPropagation(); leave(); }
  });
  search.addEventListener("input", render);
  for (const button of sections) button.addEventListener("click", () => {
    if (section === button.dataset.section) return;
    section = button.dataset.section;
    search.value = "";
    filter = "all";
    render();
    if (section === "skills" && !skillCards) void loadSkills();
    if (section === "tools") void refreshWarp();
    if (section === "plugins") void refreshConnections();
  });
  for (const button of filters) button.addEventListener("click", () => {
    filter = button.dataset.filter;
    render();
  });
  install.addEventListener("click", () => void run(true));
  open.addEventListener("click", () => void run(false));
  configure.addEventListener("click", () => portableAddons("", () => { if (panel.isConnected) void refresh(); }));
  retry.addEventListener("click", () => void refresh(true));
  skillRetry.addEventListener("click", () => void loadSkills());
  unsubscribe = api?.studioProgress(event => {
    progress.hidden = false;
    if (event.phase === "download" && Number.isFinite(event.percent)) progress.value = event.percent;
    else progress.removeAttribute("value");
    status.textContent = portableStudioProgressText(event);
  });

  const unmount = portableMountToolPage(host, panel);
  trigger.setAttribute("aria-current", "page");
  heading.focus();
  render();
  status.textContent = "Consultando plugins…";
  void refresh(true);
  void refreshConnections();
}
