async function portableVoiceStudioRequest(port, route, options = {}, allowBadRequest = false) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  try {
    const timeout = AbortSignal.timeout(options.method ? 60000 : 2500);
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
    const reply = await fetch("http://127.0.0.1:" + port + route, {...options, signal, redirect: "error"});
    if (reply.ok || (allowBadRequest && reply.status === 400)) return reply;
    await reply.body?.cancel();
  } catch {}
  return null;
}

async function portableVoiceStudioRead(reply, limit) {
  if (!reply?.body) return null;
  const reader = reply.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(Buffer.from(value));
    }
  } catch { return null; }
  finally { reader.releaseLock(); }
}

async function portableVoiceStudioCheck(port) {
  const reply = await portableVoiceStudioRequest(port, "/.well-known/voicestudio-speech");
  try {
    const data = await portableVoiceStudioRead(reply, 65536);
    return !!data && JSON.parse(data).protocol === "voicestudio.speech.v1";
  } catch { return false; }
}

async function portableVoiceStudioSpeak(port, text, voice, signal) {
  if (typeof text !== "string" || !text.trim() || text.length > 1600 ||
      typeof voice !== "string" || !voice.trim() || voice.length > 120) return null;
  const reply = await portableVoiceStudioRequest(port, "/v1/audio/speech", {
    method: "POST", headers: {"Content-Type": "application/json"}, signal,
    body: JSON.stringify({model: "tts-1", voice, input: text, language: "pt", response_format: "wav"}),
  });
  const bytes = await portableVoiceStudioRead(reply, 8 * 1024 ** 2);
  if (!bytes || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") return null;
  return {mime: "audio/wav", data: bytes.toString("base64")};
}

async function portableVoiceStudioStream(port, text, voice, signal, emit) {
  if (typeof text !== "string" || !text.trim() || text.length > 1600) return false;
  const body = {model: "tts-1", voice, input: text, language: "pt", response_format: "pcm", stream_format: "audio"};
  let fast = false;
  try {
    const health = await portableVoiceStudioRequest(port, "/health", {signal});
    const info = await portableVoiceStudioRead(health, 65536);
    fast = !!info && ["omnivoice", "omnivoice-gguf", "omnivoice-subprocess"].includes(JSON.parse(info).engine);
  } catch {}
  const request = options => portableVoiceStudioRequest(port, "/v1/audio/speech", {
    method: "POST", headers: {"Content-Type": "application/json"}, signal,
    body: JSON.stringify(options),
  }, fast);
  let reply = await request(fast ? {...body, num_step: 12} : body);
  if (fast && reply?.status === 400) {
    try {
      const data = await portableVoiceStudioRead(reply, 65536);
      const error = JSON.parse(data);
      if (error.error?.message?.includes("does not support num_step") ||
          (error.error?.code === "unsupported_parameter" && error.error?.param === "num_step")) reply = await request(body);
    } catch {}
  }
  if (!reply?.ok) return false;
  if (!reply?.body) return false;
  if (!/^audio\/pcm(?:;|$)/i.test(reply.headers.get("content-type") ?? "")) {
    await reply.body.cancel();
    return false;
  }
  const reader = reply.body.getReader();
  let pending = Buffer.alloc(0);
  let emitted = false;
  let size = 0;
  try {
    while (!signal.aborted) {
      const {done, value} = await reader.read();
      if (signal.aborted) return false;
      if (value) {
        size += value.byteLength;
        if (size > 8 * 1024 ** 2) return false;
        pending = Buffer.concat([pending, value]);
      }
      if (done || pending.length >= 3840) {
        const aligned = pending.length & ~1;
        if (aligned) {
          emit({mime: "audio/pcm;rate=24000", data: pending.subarray(0, aligned).toString("base64")});
          emitted = true;
        }
        pending = pending.subarray(aligned);
      }
      if (done) return emitted;
    }
    return false;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function portableVoiceStudioWav(chunks, size) {
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + size, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(size, 40);
  return Buffer.concat([header, ...chunks], 44 + size);
}

async function portableVoiceStudioTranscribe(port, bytes, mime, signal) {
  if (!ArrayBuffer.isView(bytes) || !bytes.byteLength || bytes.byteLength > 8 * 1024 ** 2 ||
      typeof mime !== "string" || !/^audio\/(?:wav|webm(?:;codecs=opus)?)$/i.test(mime)) return {error: "Áudio inválido."};
  const form = new FormData();
  form.append("file", new Blob([bytes], {type: mime}), mime === "audio/wav" ? "fala.wav" : "fala.webm");
  form.append("model", "whisper-1");
  form.append("language", "pt");
  form.append("response_format", "json");
  const reply = await portableVoiceStudioRequest(port, "/v1/audio/transcriptions", {method: "POST", body: form, signal});
  try {
    const data = await portableVoiceStudioRead(reply, 65536);
    if (data) {
      const result = JSON.parse(data);
      if (typeof result.text === "string") return {text: result.text.trim().slice(0, 8000)};
    }
  } catch {}
  return {error: "A transcrição local falhou. Confira o motor de transcrição e a API no VoiceStudio."};
}
