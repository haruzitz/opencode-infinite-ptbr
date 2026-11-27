function portableStudioProgressText({phase, percent}) {
  if (phase === "download" && Number.isFinite(percent)) return "Baixando o VoiceStudio… " + percent + "%";
  if (phase === "download") return "Baixando o VoiceStudio…";
  if (phase === "install") return "Instalando o VoiceStudio…";
  if (phase === "optimize") return "Preparando a voz rápida…";
  if (phase === "open") return "Abrindo o estúdio…";
  return "Conferindo o instalador oficial…";
}

function portableAddons(message = "", onClose) {
  if (document.querySelector("dialog.portable-addons[open]")) return;
  const api = window.electron?.portableVoice;
  const dialog = document.createElement("dialog");
  dialog.className = "portable-addons";
  dialog.setAttribute("aria-labelledby", "portable-addons-title");
  dialog.innerHTML = `
    <style>
      .portable-addons { position:fixed; inset:0; margin:auto; width:min(720px, calc(100vw - 28px)); max-height:calc(100vh - 32px); overflow:auto; padding:0; border:1px solid #8588a047; border-radius:18px; background:var(--v2-surface-surface-base,#171922); color:var(--v2-text-text-base,#f1f2f8); box-shadow:0 22px 90px #060815a0; }
      .portable-addons::backdrop { background:#080912af; }
      .portable-addons header, .portable-addons main { padding:20px 24px; }
      .portable-addons header { display:flex; justify-content:space-between; align-items:start; gap:12px; border-bottom:1px solid #8588a047; }
      .portable-addons h2 { font-size:24px; font-weight:650; }
      .portable-addons h3 { font-size:17px; font-weight:650; }
      .portable-addons p, .portable-addons li { font-size:13px; line-height:1.55; }
      .portable-addons .hint { margin-top:4px; color:var(--v2-text-text-muted,#afb5cc); }
      .portable-addons .mode { display:grid; gap:6px; margin-bottom:16px; }
      .portable-addons article { border:1px solid #8588a047; border-radius:14px; padding:16px; background:var(--v2-surface-surface-raised,#202332); }
      .portable-addons ol { list-style:decimal; padding-left:21px; margin:12px 0; }
      .portable-addons .fields { display:grid; grid-template-columns:minmax(90px,120px) minmax(0,1fr); gap:10px; margin:12px 0; }
      .portable-addons label { display:grid; gap:6px; font-size:13px; }
      .portable-addons button, .portable-addons input, .portable-addons select { min-height:38px; border:1px solid #8588a075; border-radius:8px; background:var(--v2-surface-surface-base,#171922); color:inherit; padding:7px 10px; }
      .portable-addons button { cursor:pointer; }
      .portable-addons button:hover { border-color:#8ba9ff; }
      .portable-addons button:focus-visible, .portable-addons input:focus-visible, .portable-addons select:focus-visible, .portable-addons a:focus-visible { outline:2px solid #8daaff; outline-offset:2px; }
      .portable-addons button:disabled { opacity:.55; cursor:default; }
      .portable-addons .actions { display:flex; flex-wrap:wrap; gap:8px; }
      .portable-addons .primary { background:#3659a2; color:#fff; }
      .portable-addons progress { width:100%; height:10px; margin-top:10px; accent-color:#7f9eff; }
      .portable-addons details { margin:12px 0; }
      .portable-addons .notice { min-height:20px; margin-top:10px; }
      .portable-addons a { text-decoration:underline; }
      @media (max-width:460px) { .portable-addons header, .portable-addons main { padding:14px; } .portable-addons .fields { grid-template-columns:1fr; } }
    </style>
    <header>
      <div><h2 id="portable-addons-title">Configurar VoiceStudio</h2><p class="hint">Escolha como usar a voz no OpenCode.</p></div>
      <button type="button" data-close>Fechar</button>
    </header>
    <main>
      <label class="mode">Modo de voz
        <select data-mode>
          <option value="cloud">Nuvem · Gemini Live</option>
          <option value="local">Local · VoiceStudio</option>
          <option value="off">Desativado</option>
        </select>
      </label>
      <p class="hint" data-mode-info></p>
      <article style="margin-top:14px">
        <h3>VoiceStudio</h3>
        <p class="hint">Transcrição e narração no computador. Reserve cerca de 10 GB para o app, o ambiente e os modelos. O consumo depende dos motores escolhidos.</p>
        <p class="hint" data-studio-state></p>
        <div class="actions" style="margin-top:12px">
          <button class="primary" type="button" data-install>Instalar VoiceStudio</button>
          <button type="button" data-open hidden>Abrir estúdio</button>
        </div>
        <progress max="100" data-progress aria-label="Progresso da instalação" hidden></progress>
        <section data-connect hidden>
          <p class="hint" style="margin-top:12px">Crie vozes, grave e duble no estúdio. Depois escolha aqui a voz que quer ouvir no OpenCode.</p>
          <div class="fields" style="grid-template-columns:minmax(0,1fr)">
            <label>Voz do OpenCode <select data-voice><option value="default">Padrão do VoiceStudio</option></select></label>
          </div>
          <div class="actions">
            <button type="button" data-refresh>Atualizar lista de vozes</button>
            <button type="button" data-test>Testar voz</button>
            <button type="button" data-enable>Usar no OpenCode</button>
          </div>
        </section>
        <details>
          <summary>Conectar uma instalação existente</summary>
          <label>Porta local <input data-port type="number" min="1" max="65535" required></label>
        </details>
      </article>
      <div class="actions" style="margin-top:16px">
        <button class="primary" type="button" data-save>Salvar preferências</button>
      </div>
      <p class="notice" role="status"></p>
    </main>`;
  const get = selector => dialog.querySelector(selector);
  const mode = get("[data-mode]");
  const port = get("[data-port]");
  const voice = get("[data-voice]");
  const test = get("[data-test]");
  const save = get("[data-save]");
  const status = get("[role=status]");
  const settings = portableVoiceSettings();
  mode.value = settings.mode;
  port.value = settings.port;
  let selectedVoice = settings.voice;
  const install = get("[data-install]");
  const open = get("[data-open]");
  const connect = get("[data-connect]");
  const progress = get("[data-progress]");
  const studioState = get("[data-studio-state]");
  status.textContent = message;
  let installed = false;
  let studioBusy = false;

  function populateVoices(entries) {
    voice.replaceChildren(new Option("Padrão do VoiceStudio", "default"));
    const values = new Set(["default"]);
    for (const entry of entries) {
      if (values.has(entry.id)) continue;
      values.add(entry.id);
      voice.add(new Option(entry.name || entry.id, entry.id));
    }
    if (!values.has(selectedVoice)) voice.add(new Option("Voz salva · " + selectedVoice, selectedVoice));
    voice.value = selectedVoice;
  }
  populateVoices([]);
  voice.addEventListener("change", () => { selectedVoice = voice.value; });
  let preview;
  let mediaUrl;
  const modes = {
    cloud: "O Gemini Live recebe o microfone e transmite as respostas em voz. O modelo do chat executa as tarefas. O ditado usa a Groq.",
    local: "O VoiceStudio processa o áudio localmente. Configure o modelo de Ditado ao vivo no VoiceStudio. O modelo do chat executa as tarefas.",
    off: "Os controles de voz ficam desativados. Você pode continuar usando o chat por texto.",
  };
  function updateMode() { get("[data-mode-info]").textContent = modes[mode.value]; }
  updateMode();
  mode.addEventListener("change", updateMode);
  get("[data-close]").addEventListener("click", () => dialog.close());
  function refreshState() {
    install.hidden = installed;
    open.hidden = !installed;
    studioState.textContent = installed ? "Aplicativo instalado no disco do OpenCode." : "Instalação opcional. O OpenCode baixa e verifica o instalador.";
  }
  async function refreshVoices(report = false) {
    try {
      const value = readSettings(true);
      if (!value) return;
      const reachable = await api.localCheck(value.port);
      if (!dialog.open) return;
      connect.hidden = !installed && !reachable;
      if (!reachable) {
        if (report) status.textContent = "Abra o estúdio e conclua a preparação inicial. Depois atualize a lista de vozes.";
        return;
      }
      const entries = await api.studioVoices(value.port);
      if (!dialog.open) return;
      populateVoices(entries);
      if (report) status.textContent = entries.length ? "Vozes carregadas." : "Conectado. Você pode usar a voz padrão ou criar um perfil no estúdio.";
    } catch { if (report) status.textContent = "Não foi possível consultar as vozes."; }
  }
  const unsubscribe = api.studioProgress(({phase, percent}) => {
    if (!dialog.open) return;
    progress.hidden = false;
    if (phase === "download" && Number.isFinite(percent)) progress.value = percent;
    else progress.removeAttribute("value");
    status.textContent = portableStudioProgressText({phase, percent});
  });
  async function openStudio(installFirst) {
    if (studioBusy) return;
    studioBusy = true;
    install.disabled = open.disabled = true;
    status.textContent = installFirst ? "Preparando a instalação…" : "Abrindo o estúdio…";
    if (installFirst) {
      progress.hidden = false;
      progress.removeAttribute("value");
    }
    try {
      const result = await (installFirst ? api.studioInstall() : api.studioOpen());
      if (!dialog.open) return;
      if (!result?.opened) { status.textContent = "Não foi possível abrir o estúdio."; return; }
      installed = true;
      if (result.port) port.value = result.port;
      connect.hidden = false;
      refreshState();
      status.textContent = ["prepared", "ready"].includes(result.fast)
        ? "Síntese rápida preparada para o OmniVoice GGUF. Na primeira vez, conclua a configuração no estúdio."
        : "Estúdio aberto. Na primeira vez, conclua a configuração guiada no VoiceStudio.";
      await refreshVoices();
    } catch (error) {
      status.textContent = error?.message?.split("Error: ").pop() || "Não foi possível preparar o VoiceStudio.";
    } finally {
      studioBusy = false;
      install.disabled = open.disabled = false;
      progress.hidden = true;
    }
  }
  install.addEventListener("click", () => void openStudio(true));
  open.addEventListener("click", () => void openStudio(false));
  get("[data-refresh]").addEventListener("click", () => void refreshVoices(true));
  get("[data-enable]").addEventListener("click", () => {
    mode.value = "local";
    updateMode();
    save.click();
  });
  function readSettings(testLocal = false) {
    if ((testLocal || mode.value === "local") && !port.reportValidity()) return null;
    return {mode: mode.value, port: port.validity.valid ? port.valueAsNumber : settings.port, voice: voice.value.trim() || "default"};
  }
  function clearPreview() {
    preview?.pause();
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = undefined;
  }
  test.addEventListener("click", async () => {
    const value = readSettings(true);
    if (!value) return;
    clearPreview();
    test.disabled = true;
    status.textContent = "Consultando o VoiceStudio… A primeira geração pode demorar.";
    try {
      if (!await api.localCheck(value.port)) {
        status.textContent = "VoiceStudio indisponível. Abra o aplicativo e confira a porta local.";
        return;
      }
      const audio = await api.localDemo(value.port, value.voice);
      if (!dialog.open) return;
      if (!audio) { status.textContent = "O serviço respondeu. Confira se o motor e a voz estão carregados."; return; }
      mediaUrl = URL.createObjectURL(new Blob([Uint8Array.from(atob(audio.data), value => value.charCodeAt(0))], {type: audio.mime}));
      preview = new Audio(mediaUrl);
      await preview.play();
      status.textContent = "Teste de áudio reproduzido.";
    } catch { status.textContent = "Não foi possível reproduzir o áudio de teste."; }
    finally { test.disabled = false; }
  });
  save.addEventListener("click", async () => {
    const value = readSettings();
    if (!value) return;
    save.disabled = true;
    try {
      if (value.mode === "local") {
        status.textContent = "Verificando a conexão local…";
        if (!await api.localCheck(value.port)) {
          status.textContent = "VoiceStudio indisponível. Abra o aplicativo e confira a porta local.";
          return;
        }
      }
      if (!dialog.open) return;
      portableSaveVoiceSettings(value);
      status.textContent = "Preferências salvas.";
    } catch { status.textContent = "Não foi possível salvar as preferências."; }
    finally { save.disabled = false; }
  });
  port.addEventListener("change", () => void refreshVoices(true));
  dialog.addEventListener("close", () => { unsubscribe(); clearPreview(); dialog.remove(); onClose?.(); }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
  refreshState();
  void api.studioStatus().then(state => {
    if (!dialog.open || !state) return;
    installed = state.installed;
    if (state.port) port.value = state.port;
    refreshState();
    if (state.installing) status.textContent = "Instalação em andamento. Aguarde ou clique em Instalar para acompanhar.";
    void refreshVoices();
  }).catch(() => {});
}
