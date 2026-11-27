import { net as portableLiveNet } from "electron";

const portableLiveCalls = new Map();
const portableLiveTool = "enviar_ao_opencode";
const portableLiveSetup = {
  model: "models/gemini-3.1-flash-live-preview",
  generationConfig: {
    responseModalities: ["AUDIO"],
    speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: "Aoede"}}},
  },
  realtimeInputConfig: {
    automaticActivityDetection: {prefixPaddingMs: 240, silenceDurationMs: 500},
    activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
  },
  inputAudioTranscription: {},
  systemInstruction: {parts: [{text: "Você encaminha o microfone ao chat do OpenCode. Para cada fala dirigida ao OpenCode, chame enviar_ao_opencode uma vez com as palavras da pessoa, sem parafrasear. Após o retorno da ferramenta, fique em silêncio. O aplicativo já lê a resposta real do chat."}]},
  tools: [{functionDeclarations: [{
    name: portableLiveTool,
    description: "Encaminha a fala ao modelo ativo do chat do OpenCode e recebe a resposta real.",
    parameters: {type: "OBJECT", properties: {fala: {type: "STRING", description: "Transcrição fiel da fala do usuário."}}, required: ["fala"]},
  }]}],
};

async function portableLiveCloudSpeak(call, text, signal, emit) {
  const fallback = "gemini-3.1-flash-tts-preview";
  const request = model => portableLiveNet.fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":streamGenerateContent?alt=sse",
    {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-goog-api-key": call.key},
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      body: JSON.stringify({
        contents: [{parts: [{text}]}],
        generationConfig: {responseModalities: ["AUDIO"], speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: "Aoede"}}}},
      }),
    }
  );
  let model = call.ttsModel ?? "gemini-3.8-flash-lite-tts";
  let reply = await request(model);
  if (reply.status === 429 && !call.ttsModel && !signal.aborted) {
    await reply.body?.cancel();
    model = fallback;
    reply = await request(model);
  }
  if (!reply.ok || !reply.body) {
    await reply.body?.cancel();
    return false;
  }
  let pending = "";
  let spoken = false;
  for await (const chunk of reply.body.pipeThrough(new TextDecoderStream())) {
    if (signal.aborted) return false;
    pending += chunk;
    let end;
    while ((end = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, end).trimEnd();
      pending = pending.slice(end + 1);
      if (!line.startsWith("data: ")) continue;
      for (const part of JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts ?? []) {
        const audio = part.inlineData;
        if (typeof audio?.data === "string" && audio.data.length <= 1024 * 1024 &&
            /^audio\/(?:pcm|l16)(?:;|$)/i.test(audio.mimeType ?? "")) {
          call.ttsModel ??= model;
          emit({data: audio.data, mime: audio.mimeType});
          spoken = true;
        }
      }
    }
    if (pending.length > 2 * 1024 * 1024) return false;
  }
  return spoken;
}

function portableLiveLocalInput(call) {
  const socket = new WebSocket("ws://127.0.0.1:" + call.port + "/v1/audio/transcriptions/stream?pcm=1&sr=16000");
  const chunks = [];
  const recorded = [];
  let size = 0;
  let ending = false;
  let fallback = false;
  let timer = setTimeout(fail, 8000);
  const input = {
    send(pcm) {
      if (ending) return;
      size += pcm.length;
      if (size > 2 * 1024 ** 2) { fail(); return; }
      recorded.push(pcm);
      if (fallback) return;
      if (socket.readyState === WebSocket.OPEN) {
        if (socket.bufferedAmount < 256 * 1024) socket.send(pcm);
        else fail();
      } else if (chunks.length < 100) chunks.push(pcm);
      else fail();
    },
    end() {
      if (ending) return;
      ending = true;
      clearTimeout(timer);
      if (fallback) { void transcribeFallback(); return; }
      timer = setTimeout(fail, 15000);
      if (socket.readyState === WebSocket.OPEN) socket.send("EOF");
    },
    close() {
      clearTimeout(timer);
      if (call.input === input) call.input = undefined;
      if (socket.readyState < WebSocket.CLOSING) socket.close();
    },
  };
  const licenceMessage = "Abra o VoiceStudio e revise a licença do modelo de Ditado ao vivo para ativar a transcrição local.";
  async function transcribeFallback() {
    try {
      const result = await portableVoiceStudioTranscribe(call.port, portableVoiceStudioWav(recorded, size), "audio/wav", call.speech.signal);
      if (call.input !== input) return;
      if (result.error) { fail(licenceMessage); return; }
      input.close();
      call.emit("ask", {prompt: result.text});
    } catch { fail(licenceMessage); }
  }
  function fail(message) {
    if (call.input !== input) return;
    input.close();
    call.emit("input-error", typeof message === "string" ? message :
      "Não foi possível transcrever no VoiceStudio. Abra Plugins e confira a configuração do VoiceStudio.");
  }
  socket.addEventListener("open", () => {
    if (!ending) clearTimeout(timer);
    for (const pcm of chunks) socket.send(pcm);
    chunks.length = 0;
    if (ending) socket.send("EOF");
  });
  socket.addEventListener("error", () => { if (!fallback) fail(); });
  socket.addEventListener("close", () => { if (!fallback) fail(); });
  socket.addEventListener("message", event => {
    if (call.input !== input || fallback) return;
    try {
      const data = JSON.parse(event.data);
      const text = typeof data.text === "string" ? data.text.trim().slice(0, 8000) : "";
      if (data.type === "partial" && text) call.emit("heard", text);
      if (data.type === "final" && data.final_kind !== "utterance") {
        input.close();
        call.emit("ask", {prompt: text});
      }
      if (data.type === "error") {
        if (data.kind === "model_licence_required") {
          fallback = true;
          clearTimeout(timer);
          if (socket.readyState < WebSocket.CLOSING) socket.close();
          if (ending) void transcribeFallback();
        } else if (data.kind === "asr_model_missing") {
          fail("Abra o VoiceStudio e instale o modelo de Ditado ao vivo para ativar a transcrição local.");
        } else fail();
      }
    } catch { fail(); }
  });
  return input;
}

function portableLiveRegister() {
  const trusted = event => event.senderFrame && !event.senderFrame.parent &&
    event.senderFrame.url.split(/[?#]/)[0] === "oc://renderer/index.html";

  portableStudioRegister(trusted);
  portableGithubIpc.handle("portable:voicestudio-check", (event, port) =>
    trusted(event) ? portableVoiceStudioCheck(port) : false);
  portableGithubIpc.handle("portable:voicestudio-demo", async (event, port, voice) => {
    if (!trusted(event) || !await portableVoiceStudioCheck(port)) return null;
    return portableVoiceStudioSpeak(port, "Olá! Esta é a voz local do OpenCode.", voice);
  });
  portableGithubIpc.handle("portable:voicestudio-transcribe", async (event, port, bytes, mime) => {
    if (!trusted(event)) return null;
    const call = portableLiveCalls.get(event.sender.id);
    if (call?.port === port && call.speech.signal.aborted) return null;
    return portableVoiceStudioTranscribe(port, bytes, mime, call?.port === port ? call.speech.signal : undefined);
  });

  portableGithubIpc.handle("portable:live-start", async (event, local) => {
    if (!trusted(event)) return false;
    const owner = event.sender;
    if (portableLiveCalls.has(owner.id)) return false;
    if (local) {
      const {port, voice} = local;
      if (typeof voice !== "string" || !voice.trim() || voice.length > 120 || (!await portableVoiceStudioCheck(port) && !await portableStudioEnsure(port)) ||
          owner.isDestroyed() || portableLiveCalls.has(owner.id)) return false;
      const call = {port, voice, speech: new AbortController()};
      const close = () => {
        call.speech.abort();
        call.input?.close();
        call.output?.abort();
        owner.removeListener("destroyed", close);
        portableLiveCalls.delete(owner.id);
      };
      call.close = close;
      call.emit = (type, value) => {
        if (!owner.isDestroyed() && portableLiveCalls.get(owner.id) === call) {
          owner.send("portable:live-event", type, value);
        }
      };
      portableLiveCalls.set(owner.id, call);
      owner.once("destroyed", close);
      return true;
    }
    const key = await portableGeminiCredential();
    if (!key || owner.isDestroyed() || portableLiveCalls.has(owner.id)) return false;
    const endpoint = new URL("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent");
    endpoint.searchParams.set("key", key);
    const socket = new WebSocket(endpoint);
    const call = {socket, key, ready: false, pending: new Set()};
    let transcript = "";
    let forwarded = false;
    let transcriptTimer;
    call.beginInterruption = () => {
      clearTimeout(transcriptTimer);
      transcript = "";
      forwarded = false;
    };
    portableLiveCalls.set(owner.id, call);
    const emit = (type, value) => {
      if (!owner.isDestroyed() && portableLiveCalls.get(owner.id) === call) {
        owner.send("portable:live-event", type, value);
      }
    };
    call.emit = emit;
    const forwardTranscript = () => {
      clearTimeout(transcriptTimer);
      if (forwarded || !transcript.trim()) return;
      forwarded = true;
      emit("ask", {prompt: transcript.trim().slice(0, 8000)});
    };
    const close = () => {
      clearTimeout(timeout);
      clearTimeout(transcriptTimer);
      call.output?.abort();
      owner.removeListener("destroyed", close);
      if (portableLiveCalls.get(owner.id) === call) portableLiveCalls.delete(owner.id);
      if (socket.readyState < WebSocket.CLOSING) socket.close();
    };
    call.close = close;
    const timeout = setTimeout(() => {
      emit("closed", "O Gemini Live não respondeu à conexão.");
      close();
    }, 15000);
    owner.once("destroyed", close);
    socket.addEventListener("open", () => socket.send(JSON.stringify({setup: portableLiveSetup})));
    socket.addEventListener("error", () => {
      emit("closed", "Não foi possível conectar ao Gemini Live. Confira a conexão e a conta Google.");
      close();
    });
    socket.addEventListener("close", event => {
      emit("closed", event.code === 1008 ? "O Gemini Live recusou a sessão. Confira a chave, a cota e o acesso ao modelo Live."
        : "Sessão de voz encerrada. Clique no ícone para conectar novamente.");
      close();
    });
    socket.addEventListener("message", async event => {
      try {
        const raw = typeof event.data === "string" ? event.data : await event.data.text();
        if (portableLiveCalls.get(owner.id) !== call) return;
        const message = JSON.parse(raw);
        if (message.setupComplete) {
          clearTimeout(timeout);
          call.ready = true;
          emit("ready");
        }
        const content = message.serverContent;
        if (content?.interrupted && forwarded) {
          transcript = "";
          forwarded = false;
        }
        if (content?.inputTranscription?.text) {
          transcript += content.inputTranscription.text;
          emit("heard", transcript);
          clearTimeout(transcriptTimer);
          if (!forwarded) transcriptTimer = setTimeout(forwardTranscript, 900);
        }
        for (const item of message.toolCall?.functionCalls ?? []) {
          if (item.name !== portableLiveTool || typeof item.id !== "string" || call.pending.has(item.id)) continue;
          if (forwarded) {
            socket.send(JSON.stringify({toolResponse: {functionResponses: [{
              id: item.id, name: portableLiveTool, response: {encaminhado: true},
            }]}}));
            continue;
          }
          forwarded = true;
          clearTimeout(transcriptTimer);
          call.pending.add(item.id);
          emit("ask", {id: item.id, prompt: typeof item.args?.fala === "string" ? item.args.fala.trim().slice(0, 8000) : ""});
        }
        for (const id of message.toolCallCancellation?.ids ?? []) call.pending.delete(id);
        if (content?.turnComplete) {
          forwardTranscript();
          transcript = "";
          forwarded = false;
        }
        if (message.goAway) emit("ending");
      } catch {}
    });
    return true;
  });

  portableGithubIpc.on("portable:live-audio", (event, samples) => {
    if (!trusted(event) || !ArrayBuffer.isView(samples) || samples.byteLength < 2 ||
        samples.byteLength > 32768 || samples.byteLength % 2) return;
    const call = portableLiveCalls.get(event.sender.id);
    const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    if (call?.port) {
      call.input ??= portableLiveLocalInput(call);
      call.input.send(pcm);
      return;
    }
    if (!call?.ready || call.socket.readyState !== WebSocket.OPEN || call.socket.bufferedAmount > 256 * 1024) return;
    const data = pcm.toString("base64");
    call.socket.send(JSON.stringify({realtimeInput: {audio: {data, mimeType: "audio/pcm;rate=16000"}}}));
  });
  portableGithubIpc.on("portable:live-audio-end", event => {
    if (trusted(event)) portableLiveCalls.get(event.sender.id)?.input?.end();
  });
  portableGithubIpc.on("portable:live-interrupt", (event, speaking) => {
    if (!trusted(event)) return;
    const call = portableLiveCalls.get(event.sender.id);
    call?.output?.abort();
    if (speaking === true) call?.beginInterruption?.();
  });
  portableGithubIpc.on("portable:live-answer", (event, id, accepted) => {
    if (!trusted(event)) return;
    const call = portableLiveCalls.get(event.sender.id);
    if (call?.socket?.readyState !== WebSocket.OPEN || typeof id !== "string" || !call.pending.delete(id)) return;
    const response = {encaminhado: accepted === true};
    call.socket.send(JSON.stringify({toolResponse: {functionResponses: [{id, name: portableLiveTool, response}]}}));
  });
  const sessionId = value => typeof value === "string" && /^ses_[A-Za-z0-9]+$/.test(value);
  portableGithubIpc.handle("portable:live-chat-baseline", (event, session) => {
    if (!trusted(event) || !portableLiveCalls.has(event.sender.id) || !sessionId(session)) return null;
    return portableLibraryDatabase(database => database.prepare(
      "SELECT COALESCE(MAX(seq), 0) AS seq FROM session_message WHERE session_id=?"
    ).get(session).seq);
  });
  portableGithubIpc.handle("portable:live-chat-reply", (event, session, prompt, after, since, turn) => {
    if (!trusted(event) || !portableLiveCalls.has(event.sender.id) || !sessionId(session) ||
        typeof prompt !== "string" || prompt.length > 8000 || !Number.isSafeInteger(after) || !Number.isFinite(since)) return null;
    return portableLibraryDatabase(database => {
      const rows = database.prepare("SELECT id, type, data FROM session_message WHERE session_id=? AND seq>? AND time_created>=? ORDER BY seq").iterate(session, after, since);
      const normalize = value => typeof value === "string" ? value.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
      const expected = normalize(prompt);
      let found;
      let finalText;
      const parts = [];
      for (const row of rows) {
        const message = JSON.parse(row.data);
        if (row.type === "user") {
          if (found) return {done: true, turn: found, text: finalText ?? parts.join("\n")};
          if (turn ? row.id === turn : normalize(message.metadata?.displayText ?? message.text) === expected) found = row.id;
        } else if (found && row.type === "assistant") {
          const text = (message.content ?? []).filter(part => part.type === "text" && typeof part.text === "string").map(part => part.text);
          parts.push(...text);
          if (message.error) return {done: true, turn: found, text: finalText, error: "O modelo registrou um erro no chat."};
          if (message.finish === "stop" && text.length) {
            finalText = text.join("\n");
            if (!message.content.some(part => part.type === "tool")) return {done: true, turn: found, text: finalText};
          }
        } else if (found && row.type === "idle") {
          return {done: true, turn: found, text: finalText ?? parts.join("\n")};
        }
      }
      return {done: false, turn: found};
    });
  });
  portableGithubIpc.handle("portable:live-speak", async (event, text, revision) => {
    if (!trusted(event) || !Number.isSafeInteger(revision) ||
        typeof text !== "string" || !text.trim() || text.length > 1600) return false;
    const call = portableLiveCalls.get(event.sender.id);
    if (!call) return false;
    call.output?.abort();
    const output = new AbortController();
    call.output = output;
    try {
      const emit = audio => { if (!output.signal.aborted) call.emit("audio", {...audio, revision}); };
      return call.port ? await portableVoiceStudioStream(call.port, text, call.voice, output.signal, emit)
        : await portableLiveCloudSpeak(call, text, output.signal, emit);
    } catch { return false; }
    finally { if (call.output === output) call.output = undefined; }
  });
  portableGithubIpc.on("portable:live-stop", event => {
    if (trusted(event)) portableLiveCalls.get(event.sender.id)?.close();
  });
}
portableLiveRegister();
