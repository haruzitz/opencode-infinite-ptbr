let portableVoiceStopActive;
let portableLiveUi;
let portableVoiceSubmission;
const portableVoiceEditors = new WeakMap();

function portableOpenMicrophone() {
  return navigator.mediaDevices.getUserMedia({audio: {
    channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: {exact: false},
  }});
}

window.addEventListener("portable-voice-settings-changed", () => {
  portableVoiceStopActive?.();
  for (const form of document.querySelectorAll('[data-component="composer"]')) {
    portableVoiceEditors.get(form)?.reset();
  }
});

function portableVoicePrompt(text, id, session) {
  const submission = portableVoiceSubmission;
  if (submission?.prompt !== text) return text;
  portableVoiceSubmission = undefined;
  submission.turn = id;
  submission.session = session;
  return "Conversa por voz em português do Brasil. A mensagem abaixo foi transcrita do microfone. " +
    "Comece com uma resposta curta, natural e que funcione falada em voz alta. " +
    "Se perguntarem se o áudio chegou, confirme que a fala foi recebida pelo aplicativo. " +
    "Use as ferramentas do projeto quando a pessoa pedir uma ação.\n\n" + text;
}

const portableVoiceSentences = new Intl.Segmenter("pt-BR", {granularity: "sentence"});
function portableVoiceChunks(text, offset, done, queue) {
  const plain = text.replace(/\x60\x60\x60[^]*?(?:\x60\x60\x60|$)/g, " ")
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[\x60*_#]/g, "");
  let rest = plain.slice(offset);
  while (rest.trim()) {
    const first = portableVoiceSentences.segment(rest).containing(0)?.segment ?? rest;
    let end = first.length;
    if (end > 210) {
      end = first.lastIndexOf(" ", 210);
      if (end < 80) end = 210;
    } else if (!done && end === rest.length && !/[.!?…]["')\]]*\s*$/.test(first)) break;
    const chunk = rest.slice(0, end).trim();
    if (chunk) queue(chunk);
    rest = rest.slice(end);
    offset += end;
  }
  return offset;
}

function portableVoiceControls(form, editor, allowed, getPath, optimize) {
  const api = window.electron?.portableVoice;
  const group = document.createElement("div");
  if (!api) return group;
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Controles de voz");
  group.style.cssText = "display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:3px 9px 7px;";
  const status = document.createElement("span");
  status.setAttribute("role", "status");
  status.style.cssText = "flex:1 1 160px;font-size:12px;";
  const meter = document.createElement("meter");
  meter.max = 100;
  meter.setAttribute("aria-label", "Nível do microfone");
  meter.hidden = true;
  group.append(status, meter);
  let job;
  let generation = 0;

  function iconButton(label, path, action, accent) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "false");
    button.style.cssText = "display:grid;place-items:center;min-width:36px;min-height:36px;border-radius:50%;cursor:pointer;" +
      (accent ? "background:#405f9f;color:#fff;" : "border:1px solid var(--v2-border-border-muted,#71748a);");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "aria-hidden": "true"})) svg.setAttribute(key, value);
    const shape = document.createElementNS(svg.namespaceURI, "path");
    shape.setAttribute("d", path);
    svg.append(shape);
    button.append(svg);
    button.addEventListener("click", action);
    group.append(button);
    return button;
  }
  const dictate = iconButton("Ditar por voz", "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM6 11v1a6 6 0 0 0 12 0v-1M12 18v4m-3 0h6", () => void activateDictation(), false);
  const talk = iconButton("Conversar por voz", "M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4", () => {
    if (portableLiveUi) { portableLiveUi.finish(); return; }
    if (allowed()) portableVoiceSetup(api, startLive, optimize);
  }, true);

  portableVoiceEditors.set(form, {form, editor, allowed, insert, status, meter, talk, reset});
  reset();
  queueMicrotask(() => portableLiveUi?.sync());
  form.addEventListener("click", event => {
    if (!job || !event.target.closest?.('[data-action="composer-submit"]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    job.send = true;
    job.finish = true;
    job.stopSegment?.();
  }, true);
  form.addEventListener("keydown", event => {
    if (event.key === "Escape" && portableVoiceStopActive) {
      event.preventDefault();
      event.stopPropagation();
      portableVoiceStopActive();
    }
  }, true);

  function configure() {
    const dialog = document.createElement("dialog");
    dialog.style.cssText = "position:fixed;inset:0;margin:auto;width:min(460px,90vw);height:fit-content;padding:20px;border:1px solid #71748a;border-radius:10px;background:#171922;color:#fff;";
    const title = document.createElement("h2");
    title.id = "portable-voice-key-title";
    title.textContent = "Configurar voz";
    dialog.setAttribute("aria-labelledby", title.id);
    const description = document.createElement("p");
    description.textContent = "O áudio gravado é enviado à Groq para transcrição. Conecte a Groq nas configurações de provedores do OpenCode ou informe uma chave aqui.";
    const link = document.createElement("a");
    link.href = "https://console.groq.com/keys";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir painel da Groq";
    const fieldLabel = document.createElement("label");
    fieldLabel.style.cssText = "display:block;margin:12px 0;";
    fieldLabel.textContent = "Chave de API da Groq ";
    const field = document.createElement("input");
    field.type = "password";
    field.autocomplete = "off";
    field.autofocus = true;
    fieldLabel.append(field);
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Salvar chave";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Fechar";
    save.style.marginInlineEnd = "12px";
    close.addEventListener("click", () => dialog.close());
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        if (!await api.configure(field.value)) {
          message.textContent = "Confira a chave Groq e a proteção de credenciais do Windows.";
          return;
        }
        status.textContent = "Voz configurada. Escolha Ditar ou Conversar por voz.";
        dialog.close();
      } catch {
        message.textContent = "Não foi possível guardar a chave.";
      } finally {
        field.value = "";
        save.disabled = false;
      }
    });
    dialog.addEventListener("close", () => dialog.remove(), {once: true});
    dialog.append(title, description, link, fieldLabel, save, close, message);
    document.body.append(dialog);
    dialog.showModal();
  }


  function release(current) {
    current.stream?.getTracks().forEach(track => track.stop());
    current.stream = undefined;
    void current.context?.close().catch(() => {});
    current.context = undefined;
    meter.hidden = true;
  }

  function cancel() {
    generation++;
    if (portableVoiceStopActive === cancel) portableVoiceStopActive = undefined;
    if (job) {
      job.finish = true;
      job.stopSegment?.();
      release(job);
      job = undefined;
    }
    reset();
    status.textContent = "Voz interrompida.";
  }

  function reset() {
    const disabled = portableVoiceSettings().mode === "off";
    for (const [button, label] of [[dictate,"Ditar por voz"],[talk,"Conversar por voz"]]) {
      button.disabled = disabled && button === dictate;
      button.title = button.disabled ? "Ative a voz na configuração de voz" : label;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", "false");
      button.style.outline = "";
    }
  }

  function insert(text) {
    const hadText = !!editor.textContent.trim();
    editor.focus({preventScroll: true});
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return document.execCommand("insertText", false, (hadText ? " " : "") + text);
  }

  async function microphone(current) {
    status.textContent = "Solicitando acesso ao microfone…";
    const stream = await portableOpenMicrophone();
    if (current.id !== generation || !form.isConnected) {
      stream.getTracks().forEach(track => track.stop());
      return false;
    }
    current.stream = stream;
    current.context = new AudioContext();
    current.analyser = current.context.createAnalyser();
    current.context.createMediaStreamSource(stream).connect(current.analyser);
    await current.context.resume();
    if (current.id !== generation) return false;
    meter.hidden = false;
    const name = stream.getAudioTracks()[0]?.label;
    status.textContent = name ? "Escutando · " + name : "Escutando…";
    return true;
  }

  function capture(current) {
    return new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(current.stream, {mimeType: "audio/webm;codecs=opus"});
      const chunks = [];
      const buffer = new Float32Array(current.analyser.fftSize);
      const started = performance.now();
      let lastSpeech = started;
      let speechFrames = 0;
      const stop = () => { if (recorder.state === "recording") recorder.stop(); };
      const tick = setInterval(() => {
        if (!current.active()) { stop(); return; }
        current.analyser.getFloatTimeDomainData(buffer);
        const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
        const now = performance.now();
        (current.meter?.() ?? meter).value = Math.min(100, rms * 500);
        if (rms >= 0.006) {
          speechFrames++;
          lastSpeech = now;
        }
        const dictating = current.mode === "dictate";
        const pause = dictating ? 600 : 1250;
        const maximum = dictating ? 6500 : 60000;
        if ((speechFrames >= 2 && now - lastSpeech >= pause) || now - started >= maximum) stop();
      }, 60);
      function cleanup() {
        clearInterval(tick);
        current.stopSegment = undefined;
      }
      recorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener("stop", () => {
        cleanup();
        resolve({blob: new Blob(chunks, {type: recorder.mimeType}), spoken: speechFrames >= 2});
      }, {once: true});
      recorder.addEventListener("error", event => { cleanup(); reject(event.error); }, {once: true});
      current.stopSegment = stop;
      try { recorder.start(); } catch (error) { cleanup(); reject(error); }
    });
  }

  async function transcribe(blob) {
    return api.transcribe(new Uint8Array(await blob.arrayBuffer()), blob.type);
  }

  async function activateDictation() {
    if (job) {
      job.finish = true;
      job.stopSegment?.();
      status.textContent = "Finalizando o ditado…";
      return;
    }
    if (!allowed() || portableVoiceSettings().mode === "off") return;
    portableVoiceStopActive?.();
    portableVoiceStopActive = cancel;
    const settings = portableVoiceSettings();
    const path = location.pathname;
    const id = ++generation;
    const current = {id, mode: "dictate", active: () => id === generation && form.isConnected && location.pathname === path};
    job = current;
    reset();
    const button = dictate;
    const label = "Concluir ditado";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "true");
    button.style.outline = "2px solid #8eaaff";
    try {
      if (settings.mode === "local" && !await api.studioEnsure(settings.port)) {
        status.textContent = "Abra o VoiceStudio em Plugins e conclua a preparação inicial no estúdio.";
        return;
      }
      if (settings.mode === "cloud" && !await api.configured()) {
        if (current.id === generation && !current.finish) configure();
        return;
      }
      if (current.id !== generation) return;
      if (current.finish || !await microphone(current)) return;
      let queue = Promise.resolve();
      let backlog = 0;
      while (current.active() && !current.finish) {
        const {blob, spoken} = await capture(current);
        if (!spoken || current.id !== generation) continue;
        backlog++;
        queue = queue.then(async () => {
          if (current.id !== generation) return;
          const result = settings.mode === "local"
            ? await api.localTranscribe(settings.port, new Uint8Array(await blob.arrayBuffer()), blob.type)
            : await transcribe(blob);
          if (current.id !== generation || !form.isConnected || location.pathname !== path) return;
          if (result?.text) {
            insert(result.text);
            status.textContent = result.uncertain ? "Revise o trecho transcrito antes de enviar." : "Ditando…";
          } else if (result?.error) status.textContent = result.error;
        }).catch(() => { if (current.id === generation) status.textContent = "Não foi possível transcrever este trecho."; })
          .finally(() => { backlog--; });
        if (backlog >= 4) {
          status.textContent = "Aguardando a transcrição dos últimos trechos…";
          current.finish = true;
        }
      }
      release(current);
      await queue;
      if (current.id === generation && form.isConnected && location.pathname === path) {
        status.textContent = "Confira o ditado e envie.";
        if (current.send && editor.textContent.trim()) form.requestSubmit();
      }
    } catch (error) {
      if (current.id !== generation) return;
      status.textContent = error?.name === "NotAllowedError" ? "Permita o uso do microfone nas configurações do Windows."
        : error?.name === "NotFoundError" ? "Nenhum microfone foi encontrado."
        : "Não foi possível usar a voz. Confira o microfone e a conexão.";
    } finally {
      if (current.id === generation) {
        release(current);
        job = undefined;
        if (portableVoiceStopActive === cancel) portableVoiceStopActive = undefined;
        reset();
      }
    }
  }

  async function startLive(settings) {
    if (portableLiveUi) { portableLiveUi.finish(); return; }
    if (!allowed() || !api.liveStart || settings.mode === "off") return;
    const local = settings.mode === "local";
    portableVoiceStopActive?.();
    const path = getPath();
    const playing = new Set();
    let context, stream, processor, source, mute, unsubscribe, watchdog;
    let ready = false;
    let ended = false;
    let scheduled = 0;
    let speechRevision = 0;
    let narrationPending = false;
    const speechQueue = [];
    function speak(text) {
      speechQueue.push(text);
      if (!narrationPending) void readSpeech();
    }
    async function readSpeech() {
      const revision = speechRevision;
      narrationPending = true;
      try {
        while (speechQueue.length && !ended && revision === speechRevision) {
          if (!playing.size) change("Preparando a resposta em voz…");
          let text = speechQueue.shift();
          while (speechQueue.length && text.length + speechQueue[0].length < 260) text += " " + speechQueue.shift();
          const spoken = await api.liveSpeak(text, revision);
          if (!spoken && revision === speechRevision) throw Error("Síntese indisponível");
        }
      } catch {
        if (!ended && revision === speechRevision) {
          speechQueue.length = 0;
          change("A voz está indisponível. A resposta está no chat.");
        }
      }
      finally {
        if (!ended && revision === speechRevision) {
          narrationPending = false;
          if (!playing.size && listening === "Respondendo por voz…") change(processing ? "O modelo do chat está trabalhando…" : "Escutando…");
        }
      }
    }
    let listening = local ? "Conectando ao VoiceStudio…" : "Conectando ao Gemini Live…";
    let boundPath = path;
    let awaitingSession = false;
    let processing = false;
    let activeTurn;
    let waitingTranscript = false;
    let turnStarted = 0;
    let lastVoice = 0;
    let voicedFrames = 0;
    const preRoll = [];
    let currentUi = portableVoiceEditors.get(form);

    function sync() {
      const currentPath = getPath();
      if (currentPath !== boundPath) {
        if (awaitingSession && /\/session\/ses_[A-Za-z0-9]+$/.test(currentPath)) {
          boundPath = currentPath;
          awaitingSession = false;
        } else { finish(); return; }
      }
      const active = [...document.querySelectorAll('[data-component="composer"]')].find(node =>
        node.getClientRects().length && portableVoiceEditors.has(node));
      if (active) {
        const next = portableVoiceEditors.get(active);
        if (currentUi !== next) {
          currentUi.reset();
          currentUi.status.textContent = "";
          currentUi = next;
        }
        currentUi.talk.title = "Encerrar conversa por voz";
        currentUi.talk.setAttribute("aria-label", currentUi.talk.title);
        currentUi.talk.setAttribute("aria-pressed", "true");
        currentUi.talk.style.outline = "2px solid #8eaaff";
        if (currentUi.status.textContent !== listening) currentUi.status.textContent = listening;
        currentUi.meter.hidden = !stream || ended;
      }
    }
    function change(message) {
      listening = message;
      sync();
    }
    async function sendToChat({id, prompt}) {
      const answer = accepted => { if (id) api.liveAnswer(id, accepted); };
      if (ended || !prompt) { answer(false); return; }
      sync();
      if (ended) return;
      const target = currentUi;
      if (!target?.form.isConnected || !target.allowed() || target.editor.textContent.trim()) {
        answer(false);
        change("Envie ou limpe o rascunho atual antes de falar um novo pedido.");
        return;
      }
      silence();
      processing = true;
      const submission = {prompt, parts: new Map(), spoken: false, muted: false};
      activeTurn = submission;
      const stillCurrent = () => !ended && activeTurn === submission;
      try {
        const sessionAtStart = /\/session\/(ses_[A-Za-z0-9]+)$/.exec(boundPath)?.[1];
        const baseline = sessionAtStart ? await api.liveBaseline(sessionAtStart) : 0;
        if (!stillCurrent() || (sessionAtStart && baseline === null) || !target.form.isConnected || target.editor.textContent.trim()) {
          answer(false);
          if (stillCurrent()) change("O chat não está pronto para receber o pedido.");
          return;
        }
        if (!target.insert(prompt)) throw new Error("Não foi possível inserir a fala.");
        awaitingSession = !sessionAtStart;
        const since = Date.now() - 3000;
        portableVoiceSubmission = submission;
        target.form.requestSubmit();
        answer(true);
        change("O modelo do chat está trabalhando…");
        let turn;
        const deadline = Date.now() + 300000;
        while (stillCurrent() && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 300));
          if (!stillCurrent()) return;
          const session = submission.session ?? /\/session\/(ses_[A-Za-z0-9]+)$/.exec(boundPath)?.[1];
          if (!session) continue;
          const result = await api.liveChatReply(session, prompt, baseline ?? 0, sessionAtStart ? 0 : since, turn ?? submission.turn);
          if (!stillCurrent()) return;
          turn ??= result?.turn;
          if (result?.done) {
            if (!submission.muted && !submission.spoken) {
              portableVoiceChunks(result.text || result.error || "O turno terminou. Confira os detalhes no chat.", 0, true, speak);
            } else if (!submission.muted) {
              for (const part of submission.parts.values()) portableVoiceChunks(part.text, part.offset, true, speak);
            }
            submission.finished = true;
            if (!playing.size && !narrationPending) change("Escutando…");
            return;
          }
        }
        if (stillCurrent() && !submission.muted) {
          change("Aguardando conclusão ou autorização no chat.");
        }
      } catch {
        if (stillCurrent()) {
          answer(false);
          change("Não foi possível acompanhar o turno por voz.");
        }
      } finally {
        if (stillCurrent()) {
          awaitingSession = false;
          processing = false;
        }
        if (portableVoiceSubmission === submission) portableVoiceSubmission = undefined;
      }
    }
    function receiveText(session, turn, message, part, text, done) {
      if (!activeTurn || activeTurn.muted || activeTurn.finished || activeTurn.turn !== turn || activeTurn.session !== session) return;
      const key = message + ":" + part;
      const offset = activeTurn.parts.get(key)?.offset ?? 0;
      const next = portableVoiceChunks(text, offset, done, speak);
      activeTurn.parts.set(key, {text, offset: next});
      if (next > offset) activeTurn.spoken = true;
    }
    function silence(interrupted = false) {
      speechRevision++;
      if (narrationPending || interrupted) api.liveInterrupt(interrupted);
      speechQueue.length = 0;
      narrationPending = false;
      for (const node of playing) { try { node.stop(); } catch {} }
      playing.clear();
      scheduled = 0;
    }
    function interruptVoice() {
      if (activeTurn) activeTurn.muted = true;
      silence(true);
      change("Ouvindo sua fala…");
    }
    function finish(message = "Conversa por voz encerrada.") {
      if (ended) return;
      ended = true;
      if (portableVoiceStopActive === finish) portableVoiceStopActive = undefined;
      if (portableLiveUi?.finish === finish) portableLiveUi = undefined;
      if (window.portableVoiceText === receiveText) delete window.portableVoiceText;
      clearInterval(watchdog);
      unsubscribe?.();
      silence();
      api.liveStop();
      processor?.disconnect();
      source?.disconnect();
      mute?.disconnect();
      stream?.getTracks().forEach(track => track.stop());
      void context?.close().catch(() => {});
      currentUi.reset();
      currentUi.status.textContent = message;
    }
    async function play({data, mime}, revision) {
      const raw = atob(data);
      let audio;
      if (mime.toLowerCase().startsWith("audio/wav")) {
        const bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
        audio = await context.decodeAudioData(bytes.buffer);
      } else {
        if (raw.length < 2 || raw.length % 2) return;
        const rate = Number(/rate=(\d+)/i.exec(mime)?.[1] ?? 24000);
        if (rate < 8000 || rate > 48000) return;
        audio = context.createBuffer(1, raw.length / 2, rate);
        const output = audio.getChannelData(0);
        for (let i = 0; i < output.length; i++) {
          const sample = raw.charCodeAt(i * 2) | raw.charCodeAt(i * 2 + 1) << 8;
          output[i] = (sample << 16 >> 16) / 32768;
        }
      }
      if (ended || revision !== speechRevision) return;
      const node = context.createBufferSource();
      node.buffer = audio;
      node.connect(context.destination);
      node.onended = () => {
        playing.delete(node);
        node.disconnect();
        if (!ended && !playing.size && !processing && !narrationPending) change("Escutando…");
      };
      scheduled = Math.max(scheduled, context.currentTime + 0.035);
      node.start(scheduled);
      scheduled += audio.duration;
      playing.add(node);
      change("Respondendo por voz…");
    }

    function localAudio(pcm, rms) {
      if (waitingTranscript) return;
      const now = performance.now();
      const speaking = rms >= (playing.size ? 0.025 : 0.009);
      if (turnStarted) {
        if (speaking) lastVoice = now;
        api.liveAudio(pcm);
        if (now - lastVoice >= 550 || now - turnStarted >= 45000) {
          turnStarted = 0;
          waitingTranscript = true;
          api.liveAudioEnd();
          change("Concluindo a transcrição…");
        }
        return;
      }
      preRoll.push(pcm);
      if (preRoll.length > 5) preRoll.shift();
      voicedFrames = speaking ? voicedFrames + 1 : 0;
      if (voicedFrames < (playing.size ? 4 : 2)) return;
      voicedFrames = 0;
      turnStarted = lastVoice = now;
      interruptVoice();
      for (const frame of preRoll.splice(0)) api.liveAudio(frame);
      change("Ouvindo sua fala…");
    }

    portableLiveUi = {finish, sync};
    window.portableVoiceText = receiveText;
    portableVoiceStopActive = finish;
    sync();
    try {
      context = new AudioContext({sampleRate: 16000});
      await context.resume();
      if (ended) return;
      unsubscribe = api.liveEvents((type, value) => {
        if (ended) return;
        if (type === "closed") { finish(value); return; }
        if (type === "ready") { ready = true; if (stream) change("Escutando…"); }
        if (type === "heard" && !processing && !narrationPending && !playing.size) change(value.trim() || "Entendendo sua fala…");
        if (type === "input-error") {
          waitingTranscript = false;
          turnStarted = voicedFrames = 0;
          preRoll.length = 0;
          change(value);
        }
        if (type === "ask") {
          waitingTranscript = false;
          if (local && !value.prompt) change("Não entendi essa fala. Pode repetir?");
          else void sendToChat(value);
        }
        if (type === "audio") void play(value, value.revision).catch(() => {
          if (!ended) change("Não foi possível reproduzir o áudio. A resposta está no chat.");
        });
        if (type === "ending") change("A sessão de voz está prestes a terminar.");
      });
      const connected = await api.liveStart(local ? {port: settings.port, voice: settings.voice} : undefined);
      if (ended) { if (connected) api.liveStop(); return; }
      if (!connected) {
        finish(local ? "Abra o VoiceStudio em Plugins e confira a porta nas configurações." : "Conecte uma chave do Google Gemini nas configurações de provedores do OpenCode.");
        return;
      }
      stream = await portableOpenMicrophone();
      if (ended) { stream.getTracks().forEach(track => track.stop()); return; }
      watchdog = setInterval(sync, 250);
      source = context.createMediaStreamSource(stream);
      if (local) ready = true;
      processor = context.createScriptProcessor(1024, 1, 1);
      mute = context.createGain();
      mute.gain.value = 0;
      processor.onaudioprocess = event => {
        if (!ready || ended) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        let energy = 0;
        for (let i = 0; i < input.length; i++) {
          const sample = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = sample * (sample < 0 ? 32768 : 32767);
          energy += sample * sample;
        }
        const rms = Math.sqrt(energy / input.length);
        currentUi.meter.value = Math.min(100, rms * 500);
        if (local) localAudio(pcm, rms);
        else {
          voicedFrames = (playing.size || narrationPending) && rms >= 0.023 ? voicedFrames + 1 : 0;
          if (voicedFrames >= 3) { voicedFrames = 0; interruptVoice(); }
          api.liveAudio(pcm);
        }
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      if (ready) change(local ? "Escutando · VoiceStudio local" : "Escutando…");
    } catch (error) {
      finish(error?.name === "NotAllowedError" ? "Permita o acesso ao microfone no Windows."
        : "Não foi possível iniciar a conversa por voz.");
    }
  }
  return group;
}
