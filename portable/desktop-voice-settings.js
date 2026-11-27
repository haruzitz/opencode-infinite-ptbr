const portableVoiceSettingsKey = "opencode.portable.voice.v1";

function portableSaveVoiceSettings(value) {
  localStorage.setItem(portableVoiceSettingsKey, JSON.stringify(value));
  window.dispatchEvent(new Event("portable-voice-settings-changed"));
}

function portableVoiceSettings() {
  const defaults = {mode: "cloud", port: 3900, voice: "default"};
  try {
    const value = JSON.parse(localStorage.getItem(portableVoiceSettingsKey));
    if (!value) return defaults;
    const mode = ["cloud", "local", "off"].includes(value.mode) ? value.mode : defaults.mode;
    const port = Number.isInteger(value.port) && value.port > 0 && value.port <= 65535 ? value.port : defaults.port;
    const voice = typeof value.voice === "string" && value.voice.trim() ? value.voice.trim().slice(0, 120) : defaults.voice;
    return {mode, port, voice};
  } catch { return defaults; }
}
