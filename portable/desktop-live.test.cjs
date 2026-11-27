const { EventEmitter } = require("node:events");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { test } = require("node:test");

function desktop(fetch, transcribe) {
  const handles = new Map();
  const listeners = new Map();
  const sockets = [];
  const events = [];
  const owner = new EventEmitter();
  owner.id = 1;
  owner.isDestroyed = () => false;
  owner.send = (...args) => events.push(args.slice(1));
  const ipcEvent = {sender: owner, senderFrame: {url: "oc://renderer/index.html"}};
  class Socket extends EventTarget {
    static OPEN = 1;
    static CLOSING = 2;
    readyState = 1;
    bufferedAmount = 0;
    sent = [];
    constructor(url) {
      super();
      this.url = String(url);
      if (this.url.startsWith("ws:")) this.readyState = 0;
      sockets.push(this);
    }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; }
    receive(value) { this.dispatchEvent(new MessageEvent("message", {data: JSON.stringify(value)})); }
  }
  const source = readFileSync(path.join(__dirname, "desktop-live-main.js"), "utf8").replace(/^import .*\r?\n/m, "");
  vm.runInNewContext(source, {
    portableGithubIpc: {handle: (name, fn) => handles.set(name, fn), on: (name, fn) => listeners.set(name, fn)},
    portableStudioRegister() {},
    portableGeminiCredential: async () => "configured-gemini-credential",
    portableLiveNet: {fetch},
    portableVoiceStudioCheck: async () => true,
    portableVoiceStudioTranscribe: transcribe,
    portableVoiceStudioWav: vm.runInNewContext(
      readFileSync(path.join(__dirname, "desktop-voicestudio-main.js"), "utf8") + "\nportableVoiceStudioWav", {Buffer}
    ),
    portableLibraryDatabase: callback => callback({prepare: () => ({
      iterate: function* () { yield {value: JSON.stringify({key: "configured-gemini-credential"})}; },
    })}),
    AbortController, AbortSignal, Buffer, TextDecoderStream, URL, WebSocket: Socket, setTimeout, clearTimeout,
  });
  return {
    invoke: (name, ...args) => handles.get("portable:" + name)(ipcEvent, ...args),
    send: (name, ...args) => listeners.get("portable:" + name)(ipcEvent, ...args),
    sockets, events,
  };
}

test("Gemini streams a chat fragment before the turn ends and aborts late audio", async () => {
  let stream;
  let signal;
  const app = desktop(async (url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.contents, [{parts: [{text: "Sim, o áudio chegou."}]}]);
    assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Aoede");
    if (url.includes("3.8-flash-lite-tts")) return new Response(null, {status: 429});
    assert.match(url, /3\.1-flash-tts-preview/);
    signal = options.signal;
    return new Response(new ReadableStream({start(controller) { stream = controller; }}));
  });
  await app.invoke("live-start");
  const socket = app.sockets[0];
  try {
    socket.receive({setupComplete: {}});
    socket.receive({toolCall: {functionCalls: [{id: "one", name: "enviar_ao_opencode", args: {fala: "Você me ouve?"}}]}});
    const audio = {data: "AAEAAg==", mimeType: "audio/pcm;rate=24000"};
    socket.receive({serverContent: {modelTurn: {parts: [{inlineData: audio}]}}});
    assert.equal(app.events.filter(([type]) => type === "audio").length, 0);
    app.send("live-answer", "one", true);
    assert.equal(JSON.parse(socket.sent.at(-1)).toolResponse.functionResponses[0].response.encaminhado, true);
    const speaking = app.invoke("live-speak", "Sim, o áudio chegou.", 7);
    await new Promise(resolve => setImmediate(resolve));
    const frame = new TextEncoder().encode("data: " + JSON.stringify({candidates: [{content: {parts: [{inlineData: audio}]}}]}) + "\n\n");
    stream.enqueue(frame);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.events.find(([type]) => type === "audio")?.[1].data, audio.data);
    assert.equal(app.events.at(-1)[1].revision, 7);
    app.send("live-interrupt");
    assert.equal(signal.aborted, true);
    stream.enqueue(frame);
    stream.close();
    assert.equal(await speaking, false);
    assert.equal(app.events.filter(([type]) => type === "audio").length, 1);
    socket.receive({serverContent: {turnComplete: true}});
    socket.receive({serverContent: {inputTranscription: {text: "Mais devagar."}, turnComplete: true}});
    assert.equal(app.events.at(-1)[1].prompt, "Mais devagar.");
  } finally { app.send("live-stop"); }
});

test("o sintetizador usado no primeiro trecho fica fixo quando a cota acaba", async () => {
  const requests = [];
  const app = desktop(async url => {
    requests.push(url);
    if (requests.length > 1) return new Response(null, {status: 429});
    const audio = {data: "AAEAAg==", mimeType: "audio/pcm;rate=24000"};
    return new Response("data: " + JSON.stringify({candidates: [{content: {parts: [{inlineData: audio}]}}]}) + "\n\n");
  });
  await app.invoke("live-start");
  try {
    assert.equal(await app.invoke("live-speak", "Primeiro trecho.", 1), true);
    assert.equal(await app.invoke("live-speak", "Segundo trecho.", 1), false);
    assert.equal(requests.length, 2);
    assert.equal(requests[0], requests[1]);
  } finally { app.send("live-stop"); }
});

test("as frases completas são lidas uma vez antes de o chat concluir", () => {
  const source = readFileSync(path.join(__dirname, "desktop-voice-renderer.js"), "utf8");
  const chunks = vm.runInNewContext(source + "\nportableVoiceChunks", {window: {addEventListener() {}}});
  const spoken = [];
  const queue = text => spoken.push(text);
  const offset = chunks("Sim, ouvi você. Agora", 0, false, queue);
  assert.deepEqual(spoken, ["Sim, ouvi você."]);
  chunks("Sim, ouvi você. Agora posso continuar.", offset, true, queue);
  assert.deepEqual(spoken, ["Sim, ouvi você.", "Agora posso continuar."]);
});

test("a captura de microfone exige ganho automático desligado", async () => {
  const source = readFileSync(path.join(__dirname, "desktop-voice-renderer.js"), "utf8");
  let request;
  const open = vm.runInNewContext(source + "\nportableOpenMicrophone", {
    window: {addEventListener() {}},
    navigator: {mediaDevices: {getUserMedia: async options => { request = options; }}},
  });
  await open();
  assert.equal(request.audio.autoGainControl.exact, false);
  assert.equal(request.audio.echoCancellation, true);
});

test("a configuração do Gemini devolve apenas o estado e guarda a chave com o armazenamento seguro", async () => {
  const source = readFileSync(path.join(__dirname, "desktop-voice-main.js"), "utf8").replace(/^import .*$/gm, "");
  const handlers = new Map();
  const files = new Map();
  const providerKey = "provider-gemini-test-key";
  const newKey = "manual-gemini-test-key";
  const encrypted = Buffer.from("encrypted test fixture");
  const credential = vm.runInNewContext(source + "\nportableGeminiCredential", {
    process: {resourcesPath: "D:\\OpenCode\\apps\\OpenCode\\resources"},
    portableGitPath: path.win32,
    portableGithubIpc: {handle: (name, handler) => handlers.set(name, handler)},
    portableLibraryDatabase: fn => fn({prepare: () => ({iterate: () => [{value: JSON.stringify({key: providerKey})}]})}),
    portableVoiceFs: {
      mkdir: async () => {},
      writeFile: async (target, data) => files.set(target, data),
      readFile: async target => files.get(target),
    },
    portableVoiceStorage: {
      isEncryptionAvailable: () => true,
      encryptString: key => { assert.equal(key, newKey); return encrypted; },
      decryptString: bytes => { if (bytes !== encrypted) throw Error("Missing secret"); return newKey; },
    },
  });
  const trusted = {senderFrame: {url: "oc://renderer/index.html"}};
  const configure = handlers.get("portable:voice-gemini-configure");
  const configured = handlers.get("portable:voice-gemini-configured");
  assert.equal(await configured(trusted), true);
  assert.equal(await credential(), providerKey);
  assert.equal(await configure(trusted, "curta"), false);
  assert.equal(await configure({senderFrame: {url: "https://example.org"}}, newKey), null);
  assert.equal(await configure(trusted, newKey), true);
  assert.deepEqual([...files.values()], [encrypted]);
  assert.equal(await credential(), newKey);
});

test("OmniVoice GGUF tenta a síntese rápida e lê normalmente numa instalação antiga", async () => {
  const source = readFileSync(path.join(__dirname, "desktop-voicestudio-main.js"), "utf8");
  const options = [];
  const speak = vm.runInNewContext(source + "\nportableVoiceStudioStream", {
    AbortSignal, Buffer,
    fetch: async (url, request) => {
      if (url.endsWith("/health")) return Response.json({engine: "omnivoice-gguf"});
      options.push(JSON.parse(request.body));
      if (options.length === 1) {
        return Response.json({error: {message: "Engine 'omnivoice-gguf' does not support num_step"}}, {status: 400});
      }
      return new Response(new Uint8Array([1, 0]), {headers: {"Content-Type": "audio/pcm"}});
    },
  });
  const output = [];
  assert.equal(await speak(3900, "Olá.", "default", new AbortController().signal, chunk => output.push(chunk)), true);
  assert.equal(options[0].num_step, 12);
  assert.equal(options[1].num_step, undefined);
  assert.equal(output[0].data, "AQA=");
});

test("VoiceStudio recebe PCM enquanto a pessoa fala e encaminha apenas o texto final", async () => {
  const app = desktop();
  await app.invoke("live-start", {port: 3900, voice: "default"});
  try {
    app.send("live-audio", new Int16Array([1, 2]));
    const socket = app.sockets[0];
    assert.match(socket?.url ?? "", /^ws:\/\/127\.0\.0\.1:3900\//);
    socket.readyState = 1;
    socket.dispatchEvent(new Event("open"));
    assert.deepEqual([...socket.sent[0]], [1, 0, 2, 0]);
    socket.receive({type: "partial", text: "Você"});
    assert.equal(app.events.find(([type]) => type === "heard")?.[1], "Você");
    app.send("live-audio-end");
    assert.equal(socket.sent.at(-1), "EOF");
    socket.receive({type: "final", final_kind: "utterance", text: "Você"});
    assert.equal(app.events.some(([type]) => type === "ask"), false);
    socket.receive({type: "final", final_kind: "summary", text: "Você consegue me ouvir?"});
    assert.equal(app.events.find(([type]) => type === "ask")?.[1].prompt, "Você consegue me ouvir?");
  } finally { app.send("live-stop"); }
});

test("VoiceStudio envia todo o áudio ao transcritor local alternativo quando a licença bloqueia o fluxo", async () => {
  const app = desktop(null, async (port, wav, mime) => {
    assert.equal(port, 3900);
    assert.equal(mime, "audio/wav");
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.deepEqual([...wav.subarray(44)], [1, 0, 2, 0, 3, 0]);
    return {text: "Teste no Whisper."};
  });
  await app.invoke("live-start", {port: 3900, voice: "default"});
  try {
    app.send("live-audio", new Int16Array([1, 2]));
    const socket = app.sockets[0];
    socket.receive({type: "error", kind: "model_licence_required"});
    app.send("live-audio", new Int16Array([3]));
    app.send("live-audio-end");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.events.find(([type]) => type === "ask")?.[1].prompt, "Teste no Whisper.");
  } finally { app.send("live-stop"); }
});
