const portableVoiceOptimizationPrompt = [
  "Quero otimizar a conversa local do VoiceStudio no OpenCode. Ajude-me em português do Brasil, com instruções simples.",
  "Comece com um diagnóstico de CPU, GPU, memória, espaço no disco, motores instalados e tempo até o primeiro áudio. Use uma frase sintética para medir. Preserve a voz escolhida e o ganho do microfone.",
  "Explique quais ajustes valem a pena neste computador e o impacto na qualidade. Peça minha aprovação antes de instalar modelos, aceitar licenças ou alterar configurações. Se precisar de algum dado, peça só o essencial.",
].join("\n\n");

function portableVoiceSetup(api, start, optimize) {
  const existing = document.querySelector("dialog.portable-voice-setup");
  if (existing) { existing.querySelector("input:checked")?.focus(); return; }
  const dialog = document.createElement("dialog");
  dialog.className = "portable-voice-setup";
  dialog.setAttribute("aria-labelledby", "portable-voice-title");
  dialog.innerHTML = `
    <style>
      .portable-voice-setup {
        position:fixed; inset:0; margin:auto; width:min(580px,calc(100vw - 28px)); max-height:calc(100vh - 28px);
        padding:0; overflow:auto; color:var(--v2-text-text-base,#f2f4fc); background:var(--v2-background-bg-base,#171a24);
        border:1px solid var(--v2-border-border-muted,#51586e); border-radius:16px; box-shadow:0 24px 75px #06081699;
        --voice-muted:var(--v2-text-text-muted,#adb6cf); --voice-line:var(--v2-border-border-muted,#51586e);
        --voice-card:var(--v2-background-bg-layer-02,#222635);
      }
      .portable-voice-setup::backdrop { background:#060913ac; }
      .portable-voice-setup [hidden] { display:none !important; }
      .portable-voice-setup h2 { font-size:23px; font-weight:650; letter-spacing:-.025em; margin:0; }
      .portable-voice-setup h3 { font-size:15px; font-weight:650; margin:0 0 4px; }
      .portable-voice-setup p { margin:0; }
      .portable-voice-setup :is(header,main,footer) { padding:18px 24px; }
      .portable-voice-setup header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; border-bottom:1px solid var(--voice-line); }
      .portable-voice-setup header p { margin-top:5px; }
      .portable-voice-setup header button { min-width:38px; padding-inline:8px; font-size:19px; line-height:1; }
      .portable-voice-setup .hint, .portable-voice-setup small { color:var(--voice-muted); font-size:13px; line-height:1.45; }
      .portable-voice-setup fieldset { border:0; margin:0 0 14px; padding:0; min-width:0; display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .portable-voice-setup .choice { min-width:0; display:grid; grid-template-columns:16px minmax(0,1fr); gap:10px; padding:12px; cursor:pointer; background:var(--voice-card); border:1px solid var(--voice-line); border-radius:10px; }
      .portable-voice-setup .choice:has(input:checked) { border-color:#829fff; box-shadow:inset 0 0 0 1px #829fff; }
      .portable-voice-setup .choice:has(input:focus-visible) { outline:2px solid #829fff; outline-offset:2px; }
      .portable-voice-setup .choice input { width:16px; height:16px; margin-top:3px; accent-color:#829fff; }
      .portable-voice-setup .choice strong, .portable-voice-setup .choice small { display:block; }
      .portable-voice-setup .panel { border-top:1px solid var(--voice-line); padding-top:14px; }
      .portable-voice-setup .field { display:grid; gap:4px; font-size:13px; font-weight:600; margin:10px 0; }
      .portable-voice-setup .key-block + .key-block { border-top:1px solid var(--voice-line); margin-top:12px; padding-top:12px; }
      .portable-voice-setup .key-block p { margin-top:3px; }
      .portable-voice-setup .key-block a { color:inherit; text-decoration:underline; text-underline-offset:2px; }
      .portable-voice-setup :is(button, input:not([type=radio]), select) { color:inherit; background:var(--voice-card); border:1px solid var(--voice-line); border-radius:8px; padding:7px 11px; min-height:36px; }
      .portable-voice-setup button { cursor:pointer; }
      .portable-voice-setup button:hover:enabled { border-color:#829fff; }
      .portable-voice-setup button:disabled { opacity:.52; cursor:default; }
      .portable-voice-setup :is(button, input, select, summary, a):focus-visible { outline:2px solid #829fff; outline-offset:2px; }
      .portable-voice-setup .choice input:focus-visible { outline:none; }
      .portable-voice-setup input[type=password] { width:100%; }
      .portable-voice-setup .row, .portable-voice-setup footer { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
      .portable-voice-setup footer { justify-content:space-between; border-top:1px solid var(--voice-line); }
      .portable-voice-setup button.primary { background:#405f9f; border-color:#5474b8; color:#fff; font-weight:650; }
      .portable-voice-setup .fine { min-height:1.3em; color:var(--voice-muted); font-size:12px; margin-top:8px; }
      .portable-voice-setup details { margin-top:12px; font-size:13px; }
      .portable-voice-setup summary { cursor:pointer; }
      .portable-voice-setup progress { width:100%; height:9px; accent-color:#829fff; margin-top:10px; }
      @media (max-width:440px) {
        .portable-voice-setup :is(header,main,footer) { padding:14px; }
        .portable-voice-setup fieldset { grid-template-columns:1fr; }
        .portable-voice-setup footer .row { justify-content:flex-end; margin-left:auto; }
      }
    </style>
    <header>
      <div><h2 id="portable-voice-title">Conversa por voz</h2><p class="hint" id="portable-voice-intro">Escolha onde o áudio será processado.</p></div>
      <button type="button" data-close aria-label="Fechar configuração de voz" title="Fechar">×</button>
    </header>
    <main>
      <fieldset aria-labelledby="portable-voice-intro">
        <label class="choice"><input type="radio" name="voice-mode" value="cloud"><span><strong>Nuvem</strong><small>Gemini Live, pela internet</small></span></label>
        <label class="choice"><input type="radio" name="voice-mode" value="local"><span><strong>Neste computador</strong><small>VoiceStudio, áudio local</small></span></label>
      </fieldset>
      <section class="panel" data-cloud>
        <div class="key-block">
          <h3>Gemini Live</h3>
          <p class="hint">1. Abra o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a> e entre com sua conta.</p>
          <p class="hint">2. Crie uma chave de API e cole abaixo.</p>
          <label class="field">Chave Gemini <input type="password" data-gemini autocomplete="off" spellcheck="false" placeholder="Cole sua chave"></label>
          <small data-gemini-state></small>
        </div>
        <details class="key-block">
          <summary>Groq <span class="hint">· opcional, para o botão de ditado</span></summary>
          <p class="hint">1. Abra o <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">painel de chaves da Groq</a> e entre na sua conta.</p>
          <p class="hint">2. Crie uma chave de API e cole abaixo.</p>
          <label class="field">Chave Groq <input type="password" data-groq autocomplete="off" spellcheck="false" placeholder="Cole sua chave"></label>
          <small data-groq-state></small>
        </details>
      </section>
      <section class="panel" data-local hidden>
        <h3>VoiceStudio</h3>
        <p class="hint">O áudio fica no computador. Durante a conversa, o VoiceStudio pode reduzir o desempenho de outros programas, especialmente jogos. A primeira configuração também precisa de espaço no disco.</p>
        <p class="fine" data-studio-state></p>
        <div class="row">
          <button type="button" data-install>Instalar VoiceStudio</button>
          <button type="button" data-open>Abrir VoiceStudio</button>
          <button type="button" data-refresh>Verificar conexão</button>
        </div>
        <progress max="100" aria-label="Progresso da instalação do VoiceStudio" hidden></progress>
        <label class="field">Voz da conversa <select data-voice><option value="default">Padrão do VoiceStudio</option></select></label>
        <details><summary>Conectar uma instalação existente</summary>
          <label class="field">Porta local <input data-port type="number" min="1" max="65535" required></label>
        </details>
        <div class="row" style="margin-top:12px">
          <button type="button" data-optimize>Otimizar no chat</button>
          <small>Abre uma conversa com um pedido de diagnóstico pronto.</small>
        </div>
      </section>
      <p class="fine" role="status"></p>
    </main>
    <footer>
      <p class="hint">O modelo do chat executa as tarefas.</p>
      <div class="row">
        <button type="button" data-save-keys>Salvar chaves</button>
        <button class="primary" type="button" data-start>Iniciar conversa</button>
      </div>
    </footer>`;
  const get = selector => dialog.querySelector(selector);
  const settings = portableVoiceSettings();
  const local = get("[data-local]");
  const port = get("[data-port]");
  const voice = get("[data-voice]");
  const install = get("[data-install]");
  const open = get("[data-open]");
  const refresh = get("[data-refresh]");
  const progress = get("progress");
  const status = get("[role=status]");
  const save = get("[data-save-keys]");
  const begin = get("[data-start]");
  const gemini = get("[data-gemini]");
  const groq = get("[data-groq]");
  let mode = settings.mode === "local" ? "local" : "cloud";
  let studio = {};
  let connected = false;
  let busy = false;
  let hasGemini = false;
  let voiceId = settings.voice;
  let requestId = 0;
  port.value = settings.port;
  get('input[value="' + mode + '"]').checked = true;

  function selectVoice(entries = []) {
    const values = new Set(["default"]);
    voice.replaceChildren(new Option("Padrão do VoiceStudio", "default"));
    for (const {id, name} of entries) {
      if (values.has(id)) continue;
      values.add(id);
      voice.add(new Option(name, id));
    }
    if (!values.has(voiceId)) voice.add(new Option("Voz salva", voiceId));
    voice.value = voiceId;
  }
  function display() {
    local.hidden = mode !== "local";
    get("[data-cloud]").hidden = mode !== "cloud";
    save.hidden = mode !== "cloud";
    install.hidden = !!studio.installed || connected;
    open.hidden = !studio.installed;
    refresh.hidden = !studio.installed && !connected;
    voice.disabled = !connected || busy;
    install.disabled = open.disabled = refresh.disabled = begin.disabled = save.disabled = busy;
    get("[data-optimize]").disabled = busy;
    dialog.querySelectorAll("input[name=voice-mode]").forEach(input => { input.disabled = busy; });
    const fast = ["ready", "prepared"].includes(studio.fast) ? " Síntese rápida preparada para o OmniVoice GGUF."
      : studio.fast === "available" && connected ? " Reabra o VoiceStudio para carregar a voz rápida." : "";
    get("[data-studio-state]").textContent = connected ? "VoiceStudio conectado." + fast
      : studio.installed ? "VoiceStudio instalado. Abra o estúdio para concluir a preparação." + fast
        : "Instale pelo OpenCode ou conecte um estúdio que já esteja no computador.";
  }
  async function refreshLocal() {
    const current = ++requestId;
    const value = port.valueAsNumber;
    const reachable = port.validity.valid && await api.localCheck(value).catch(() => false);
    if (!dialog.open || current !== requestId) return;
    connected = reachable;
    display();
    if (reachable) void api.studioVoices(value).then(entries => {
      if (dialog.open && current === requestId) selectVoice(entries);
    }).catch(() => {});
    return reachable;
  }
  async function refreshKeys() {
    const [google, groqReady] = await Promise.all([
      api.geminiConfigured().catch(() => false), api.configured().catch(() => false),
    ]);
    if (!dialog.open) return;
    hasGemini = google;
    get("[data-gemini-state]").textContent = google ? "Chave já configurada. Você pode deixar o campo vazio." : "Necessária para iniciar a conversa em nuvem.";
    get("[data-groq-state]").textContent = groqReady ? "Chave já configurada." : "Preencha se quiser usar o ditado em nuvem.";
  }
  async function saveKeys() {
    if (gemini.value.trim()) {
      if (!await api.geminiConfigure(gemini.value)) {
        status.textContent = "Confira se copiou a chave Gemini inteira.";
        return false;
      }
      gemini.value = "";
      hasGemini = true;
    }
    if (groq.value.trim()) {
      if (!await api.configure(groq.value)) {
        status.textContent = "Confira se copiou a chave Groq inteira.";
        return false;
      }
      groq.value = "";
    }
    void refreshKeys();
    return true;
  }
  async function action(run) {
    if (busy) return;
    busy = true;
    status.textContent = "";
    display();
    try { await run(); }
    catch { status.textContent = "Não foi possível concluir esta etapa. Tente novamente."; }
    finally { busy = false; progress.hidden = true; display(); }
  }
  async function prepareStudio(installFirst) {
    status.textContent = installFirst ? "Preparando a instalação…" : "Abrindo o VoiceStudio…";
    const result = await (installFirst ? api.studioInstall() : api.studioOpen());
    if (!dialog.open) return;
    if (!result?.opened) throw Error("VoiceStudio indisponível");
    studio = {installed: true, port: result.port, fast: result.fast};
    if (result.port) port.value = result.port;
    progress.hidden = true;
    status.textContent = await refreshLocal() ? "Pronto para conversar."
      : "Conclua a preparação na janela do VoiceStudio e depois verifique a conexão aqui.";
  }
  let studioEdited = false;
  port.addEventListener("input", () => { studioEdited = true; });
  port.addEventListener("change", () => { void refreshLocal(); });
  voice.addEventListener("change", () => { voiceId = voice.value; });
  dialog.querySelectorAll("input[name=voice-mode]").forEach(input => input.addEventListener("change", () => {
    mode = input.value;
    status.textContent = "";
    display();
    if (mode === "local") void refreshLocal();
  }));
  get("[data-close]").addEventListener("click", () => dialog.close());
  install.addEventListener("click", () => void action(() => prepareStudio(true)));
  open.addEventListener("click", () => void action(() => prepareStudio(false)));
  refresh.addEventListener("click", () => void action(async () => {
    status.textContent = await refreshLocal() ? "VoiceStudio conectado." : "O estúdio ainda está iniciando ou precisa de configuração.";
  }));
  get("[data-optimize]").addEventListener("click", () => void action(async () => {
    await optimize(portableVoiceOptimizationPrompt);
    dialog.close();
  }));
  save.addEventListener("click", () => void action(async () => {
    if (await saveKeys()) status.textContent = "Chaves salvas.";
  }));
  begin.addEventListener("click", () => void action(async () => {
    if (mode === "cloud") {
      if (!await saveKeys()) return;
      if (!hasGemini && !await api.geminiConfigured()) {
        status.textContent = "Cole a chave Gemini para começar.";
        gemini.focus();
        return;
      }
    } else {
      if (!port.reportValidity()) return;
      if (!await api.localCheck(port.valueAsNumber).catch(() => false)) {
        status.textContent = "Abra ou instale o VoiceStudio e depois verifique a conexão.";
        (studio.installed ? open : install).focus();
        return;
      }
    }
    if (!dialog.open) return;
    const value = {mode, port: port.validity.valid ? port.valueAsNumber : settings.port, voice: voiceId};
    portableSaveVoiceSettings(value);
    dialog.close();
    void start(value);
  }));
  const unsubscribe = api.studioProgress(({phase, percent}) => {
    if (!dialog.open) return;
    progress.hidden = false;
    if (phase === "download") progress.value = percent;
    else progress.removeAttribute("value");
    status.textContent = {
      check: "Verificando o instalador oficial…",
      download: "Baixando VoiceStudio… " + percent + "%",
      install: "Instalando VoiceStudio…",
      optimize: "Preparando a voz rápida…",
      open: "Abrindo o VoiceStudio…",
    }[phase] ?? "";
  });
  dialog.addEventListener("close", () => { unsubscribe(); dialog.remove(); }, {once: true});
  document.body.append(dialog);
  dialog.showModal();
  get("input:checked").focus();
  selectVoice();
  display();
  void refreshKeys();
  void api.studioStatus().then(state => {
    if (!dialog.open || !state) return;
    studio = state;
    if (state.port && !studioEdited && settings.mode !== "local") port.value = state.port;
    display();
    if (mode === "local") void refreshLocal();
  }).catch(() => {});
}
