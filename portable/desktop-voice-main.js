import { safeStorage as portableVoiceStorage, net as portableVoiceNet } from "electron";
import { promises as portableVoiceFs } from "node:fs";

function portableVoiceKeyPath(provider) {
  return portableGitPath.resolve(process.resourcesPath, "..", "..", "..", "profile", "secrets", "voice-" + provider + ".dpapi");
}

async function portableVoiceStoredKey(provider) {
  return portableVoiceStorage.decryptString(await portableVoiceFs.readFile(portableVoiceKeyPath(provider))).trim();
}

async function portableVoiceSaveKey(provider, key) {
  if (!portableVoiceStorage.isEncryptionAvailable()) return false;
  const path = portableVoiceKeyPath(provider);
  await portableVoiceFs.mkdir(portableGitPath.dirname(path), {recursive: true});
  await portableVoiceFs.writeFile(path, portableVoiceStorage.encryptString(key));
  return true;
}

function portableIsGeminiKey(key) {
  return typeof key === "string" && /^[A-Za-z0-9._-]{20,240}$/.test(key);
}

async function portableGeminiCredential() {
  const saved = await portableVoiceStoredKey("gemini").catch(() => null);
  if (portableIsGeminiKey(saved)) return saved;
  return portableLibraryDatabase(database => {
    const rows = database.prepare(
      "SELECT value FROM credential WHERE integration_id IN ('google','gemini') AND active=1 ORDER BY time_updated DESC"
    ).iterate();
    for (const {value} of rows) {
      try {
        const {key} = JSON.parse(value);
        if (portableIsGeminiKey(key)) return key;
      } catch {}
    }
    return null;
  });
}

async function portableVoiceCredential() {
  const providerKey = await portableLibraryDatabase(database => {
    const rows = database.prepare(
      "SELECT value FROM credential WHERE integration_id = ? AND active = 1 ORDER BY time_updated DESC"
    ).iterate("groq");
    for (const {value} of rows) {
      try {
        const {key} = JSON.parse(value);
        if (typeof key === "string" && /^gsk_[A-Za-z0-9]{20,120}$/.test(key)) return key;
      } catch {}
    }
    return null;
  });
  if (providerKey) return {key: providerKey, source: "provider"};
  try {
    const key = await portableVoiceStoredKey("groq");
    return {key, source: "voice"};
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function portableVoiceRegister() {
  function handle(name, callback) {
    portableGithubIpc.handle("portable:voice-" + name, (event, ...args) => {
      const frame = event.senderFrame;
      if (!frame || frame.parent || frame.url.split(/[?#]/)[0] !== "oc://renderer/index.html") return null;
      return callback(...args);
    });
  }
  handle("configured", async () => (await portableVoiceCredential())?.source ?? null);
  handle("gemini-configured", async () => !!await portableGeminiCredential());
  handle("gemini-configure", async value => {
    const key = typeof value === "string" ? value.trim() : "";
    return portableIsGeminiKey(key) && portableVoiceSaveKey("gemini", key);
  });
  handle("configure", async value => {
    const key = typeof value === "string" ? value.trim() : "";
    return /^gsk_[A-Za-z0-9]{20,120}$/.test(key) && portableVoiceSaveKey("groq", key);
  });
  handle("transcribe", async (bytes, mime) => {
    if (!(ArrayBuffer.isView(bytes)) || !bytes.byteLength || bytes.byteLength > 8 * 1024 ** 2 ||
        typeof mime !== "string" || !/^audio\/webm(?:;codecs=opus)?$/i.test(mime)) return {error: "Áudio inválido."};
    const credential = await portableVoiceCredential();
    const key = credential?.key;
    if (!key) return {error: "Configure sua chave Groq para usar o microfone."};
    const form = new FormData();
    form.append("file", new Blob([bytes], {type: mime}), "ditado.webm");
    form.append("model", "whisper-large-v3");
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");
    form.append("language", "pt");
    const reply = await portableVoiceNet.fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST", headers: {Authorization: "Bearer " + key}, body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (reply.status === 401 || reply.status === 403) return {error: credential.source === "provider"
      ? "A Groq recusou a chave. Reconecte a Groq nas configurações de provedores do OpenCode."
      : "A Groq recusou a chave. Atualize a chave nas opções de voz."};
    if (reply.status === 429) return {error: "A cota de transcrição da Groq foi atingida."};
    if (!reply.ok) return {error: "Não foi possível transcrever o áudio."};
    const result = await reply.json();
    const text = typeof result.text === "string" ? result.text.trim() : "";
    const segments = Array.isArray(result.segments) ? result.segments : [];
    const speech = segments.filter(segment => Number.isFinite(segment.no_speech_prob));
    if (speech.length && speech.every(segment => segment.no_speech_prob >= 0.75)) {
      return {error: "A Groq não detectou fala clara. Confira o microfone e grave novamente."};
    }
    const uncertain = segments.some(segment => segment.avg_logprob < -0.75 || segment.no_speech_prob > 0.55);
    return {text, uncertain};
  });

}
portableVoiceRegister();
