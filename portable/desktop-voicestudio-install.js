import { spawn as portableStudioSpawn } from "node:child_process";
import { createHash as portableStudioHash } from "node:crypto";
import { constants as portableStudioFsFlags, createWriteStream as portableStudioWrite, promises as portableStudioFs } from "node:fs";
import { createServer as portableStudioServer } from "node:net";
import { Readable as PortableStudioReadable, Transform as PortableStudioTransform } from "node:stream";
import { pipeline as portableStudioPipeline } from "node:stream/promises";

let portableStudioInstallation;
let portableStudioOpening;
const portableStudioFastStock = "75afbec6ccd84ca47c41f5bd96c48cfef375d0823f2eb947f5004d7fadb15bcd";
const portableStudioFastPatched = "e51c2197caf0227ad33aa1329abb5aa5659331a5a19a0575aa4c272720c6ceed";

async function portableStudioFastAdapter(app, prepare = false) {
  const relative = portableGitPath.join("resources", "backend", "engines", "omnivoice_gguf", "backend.py");
  const path = portableGitPath.join(app, relative);
  const digest = source => portableStudioHash("sha256").update(source).digest("hex");
  try {
    const real = await portableStudioFs.realpath(path);
    if (portableGitPath.relative(await portableStudioFs.realpath(app), real) !== relative) return "standard";
    const file = await portableStudioFs.stat(real);
    if (!file.isFile() || file.size > 200000) return "standard";
    const original = await portableStudioFs.readFile(real, "utf8");
    const source = original.replace(/\r\n/g, "\n");
    const hash = digest(source);
    if (hash === portableStudioFastPatched) return "ready";
    if (hash !== portableStudioFastStock) {
      return /^\s*supports_num_step = True$/m.test(source) ? "official" : "standard";
    }
    if (!prepare) return "available";

    // VoiceStudio 0.5.8 ships a CLI with --steps and a resident server pinned to 32.
    const updated = source
      .replace(/        # The bundled omnivoice-tts CLI has no num_step\/guidance_scale[^]*?        supports_num_step = False/,
        "        supports_num_step = True\n        num_step_range = (1, 64)")
      .replace('                        duration=kw.get("duration"),\n                        seed=kw.get("seed"),',
        '                        duration=kw.get("duration"),\n                        num_step=kw.get("num_step"),\n                        seed=kw.get("seed"),')
      .replace("            from . import resident\n\n            if not resident.resident_enabled():",
        "            from . import resident\n\n            # The bundled resident binary always decodes 32 steps.\n            if kw.get(\"num_step\") not in (None, 32):\n                return None\n            if not resident.resident_enabled():")
      .replace("            duration: Optional[float] = None,\n            seed: Optional[int] = None,",
        "            duration: Optional[float] = None,\n            num_step: Optional[int] = None,\n            seed: Optional[int] = None,")
      .replace('            if seed is not None:\n                argv += ["--seed", str(int(seed))]',
        '            if num_step is not None:\n                argv += ["--steps", str(int(num_step))]\n            if seed is not None:\n                argv += ["--seed", str(int(seed))]');
    if (digest(updated) !== portableStudioFastPatched) return "standard";
    const backup = portableGitPath.join(portableGitPath.dirname(app), "VoiceStudio-0.5.8-OmniVoice.original.py");
    await portableStudioFs.copyFile(real, backup, portableStudioFsFlags.COPYFILE_EXCL)
      .catch(error => { if (error.code !== "EEXIST") throw error; });
    const stage = await portableStudioFs.mkdtemp(portableGitPath.join(portableGitPath.dirname(real), ".opencode-"));
    const replacement = portableGitPath.join(stage, "backend.py");
    try {
      await portableStudioFs.writeFile(replacement, original.includes("\r\n") ? updated.replace(/\n/g, "\r\n") : updated, {flag: "wx"});
      await portableStudioFs.rename(replacement, real);
    } finally {
      await portableStudioFs.unlink(replacement).catch(() => {});
      await portableStudioFs.rmdir(stage).catch(() => {});
    }
    return "prepared";
  } catch { return "standard"; }
}

function portableStudioRelease(release, arch) {
  const tag = release?.tag_name;
  if (release?.draft || release?.prerelease || typeof tag !== "string" || !/^v\d+\.\d+\.\d+$/.test(tag) ||
      !Array.isArray(release.assets)) return null;
  for (const format of arch === "arm64" ? ["arm64", "x64"] : ["x64"]) {
    const name = "VoiceStudio-" + tag.slice(1) + "-win-" + format + ".exe";
    const url = "https://github.com/debpalash/VoiceStudio/releases/download/" + tag + "/" + name;
    const asset = release.assets.find(entry => entry.name === name && entry.browser_download_url === url &&
      /^sha256:[a-f0-9]{64}$/.test(entry.digest ?? "") &&
      Number.isSafeInteger(entry.size) && entry.size > 0 && entry.size < 1024 ** 3);
    if (asset) return {url, sha256: asset.digest.slice(7), size: asset.size};
  }
  return null;
}

function portableStudioPaths() {
  const root = portableGitPath.resolve(process.resourcesPath, "..", "..", "..", "Complementos", "VoiceStudio");
  const app = portableGitPath.join(root, "App");
  return {root, app, exe: portableGitPath.join(app, "VoiceStudio.exe"), config: portableGitPath.join(root, "porta.txt")};
}

async function portableStudioStatus() {
  const {exe, config, app} = portableStudioPaths();
  const [exists, saved] = await Promise.all([
    portableStudioFs.stat(exe).then(stat => stat.isFile(), () => false),
    portableStudioFs.readFile(config, "utf8").catch(() => ""),
  ]);
  const port = Number(saved);
  return {installed: exists, port: port >= 1 && port <= 65535 && Number.isInteger(port) ? port : null,
    installing: !!portableStudioInstallation, fast: exists ? await portableStudioFastAdapter(app) : "standard"};
}

function portableStudioEnvironment(managed) {
  const environment = {};
  const variables = /^(SystemRoot|WinDir|SystemDrive|ComSpec|Path|PATHEXT|ProgramFiles(?:\(x86\))?|ProgramW6432|ProgramData|CommonProgramFiles(?:\(x86\))?|CommonProgramW6432|ALLUSERSPROFILE|PUBLIC|USERDOMAIN|USERNAME|NUMBER_OF_PROCESSORS|PROCESSOR_(?:ARCHITECTURE|ARCHITEW6432|IDENTIFIER)|HTTP_PROXY|HTTPS_PROXY|NO_PROXY)$/i;
  for (const [key, value] of Object.entries(process.env)) {
    if (variables.test(key)) environment[key] = value;
  }
  for (const key of ["APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "TEMP", "TMP"]) {
    const value = process.env["OPENCODE_WINDOWS_" + key] ?? process.env[key];
    if (value) environment[key] = value;
  }
  return {...environment, ...managed};
}

function portableStudioChoosePort(preferred) {
  return new Promise(resolve => {
    const server = portableStudioServer();
    server.once("error", () => resolve(null));
    server.listen(preferred, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function portableStudioLaunch() {
  const state = await portableStudioStatus();
  if (!state.installed) return {opened: false};
  const {root, app, exe, config} = portableStudioPaths();
  const fast = await portableStudioFastAdapter(app, true);
  const dir = name => portableGitPath.join(root, name);
  let port = state.port;
  if (!port) {
    port = await portableStudioChoosePort(3900) ?? await portableStudioChoosePort(0);
    if (!port) throw new Error("Não foi possível reservar uma porta para o VoiceStudio.");
    await portableStudioFs.writeFile(config, String(port), "utf8");
  }
  const dirs = ["Perfil", "Dados", "Modelos", "Motores", "Temporários", "Cache", "Python"];
  await Promise.all(dirs.map(name => portableStudioFs.mkdir(dir(name), {recursive: true})));
  const child = portableStudioSpawn(exe, [], {
    cwd: app, detached: true, stdio: "ignore",
    env: portableStudioEnvironment({
      APPDATA: dir("Perfil"), LOCALAPPDATA: dir("Perfil"),
      OMNIVOICE_PORT: String(port), OMNIVOICE_DATA_DIR: dir("Dados"),
      OMNIVOICE_CACHE_DIR: dir("Modelos"), OMNIVOICE_ENGINES_DIR: dir("Motores"),
      OMNIVOICE_ENV_FILE: portableGitPath.join(root, "Dados", "env"),
      TEMP: dir("Temporários"), TMP: dir("Temporários"),
      UV_CACHE_DIR: dir("Cache"), UV_PYTHON_INSTALL_DIR: dir("Python"),
      HF_HOME: portableGitPath.join(root, "Modelos", "HuggingFace"),
    }),
  });
  await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  child.unref();
  return {opened: true, port, fast};
}

function portableStudioOpen() {
  portableStudioOpening ??= portableStudioLaunch().finally(() => { portableStudioOpening = undefined; });
  return portableStudioOpening;
}

async function portableStudioEnsure(port) {
  const [reachable, state] = await Promise.all([portableVoiceStudioCheck(port), portableStudioStatus()]);
  if (reachable) {
    if (state.installed && state.port === port && state.fast === "available") {
      await portableStudioFastAdapter(portableStudioPaths().app, true);
    }
    return true;
  }
  if (!state.installed || state.port !== port) return false;
  await portableStudioOpen();
  const started = Date.now();
  do {
    if (await portableVoiceStudioCheck(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 800));
  } while (Date.now() - started < 15000);
  return false;
}

async function portableStudioDownload(asset, file, progress, fetchAsset = portableLiveNet.fetch.bind(portableLiveNet)) {
  const response = await fetchAsset(asset.url, {signal: AbortSignal.timeout(20 * 60 * 1000)});
  if (!response.ok || !response.body) throw new Error("Não foi possível baixar o instalador do VoiceStudio.");
  const hash = portableStudioHash("sha256");
  let received = 0;
  let reported = -1;
  const verify = new PortableStudioTransform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > asset.size) return callback(new Error("O download excedeu o tamanho esperado."));
      hash.update(chunk);
      const percent = Math.floor(received * 100 / asset.size);
      if (percent !== reported) {
        progress({phase: "download", percent});
        reported = percent;
      }
      callback(null, chunk);
    },
  });
  await portableStudioPipeline(PortableStudioReadable.fromWeb(response.body), verify, portableStudioWrite(file, {flags: "wx"}));
  if (received !== asset.size || hash.digest("hex") !== asset.sha256) {
    throw new Error("A verificação do instalador falhou. Tente baixar novamente.");
  }
}

async function portableStudioInstall(progress) {
  if ((await portableStudioStatus()).installed) return portableStudioOpen();
  const {root, app, exe} = portableStudioPaths();
  progress({phase: "check"});
  await portableStudioFs.mkdir(root, {recursive: true});
  const disk = await portableStudioFs.statfs(root);
  if (disk.bavail * disk.bsize < 10_000_000_000) {
    throw new Error("Libere cerca de 10 GB no disco do OpenCode para instalar o VoiceStudio.");
  }
  const response = await portableLiveNet.fetch("https://api.github.com/repos/debpalash/VoiceStudio/releases/latest", {
    signal: AbortSignal.timeout(15000), redirect: "error",
  });
  const arch = process.env.PROCESSOR_ARCHITEW6432 === "ARM64" ? "arm64" : process.arch;
  const asset = response.ok ? portableStudioRelease(await response.json(), arch) : null;
  if (!asset) throw new Error("Não foi possível encontrar um instalador oficial verificável. Tente novamente.");
  const staging = await portableStudioFs.mkdtemp(portableGitPath.join(root, "download-"));
  const file = portableGitPath.join(staging, "VoiceStudio-Setup.exe");
  try {
    await portableStudioDownload(asset, file, progress);
    progress({phase: "install"});
    const child = portableStudioSpawn(file, ["/S", "/currentuser", "/D=" + app], {
      cwd: staging, stdio: "ignore", windowsHide: true, windowsVerbatimArguments: true,
      env: portableStudioEnvironment({TEMP: staging, TMP: staging}),
    });
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    if (![0, 3010].includes(code) || !await portableStudioFs.stat(exe).then(stat => stat.isFile(), () => false)) {
      throw new Error("O Windows não concluiu a instalação do VoiceStudio.");
    }
  } finally {
    await portableStudioFs.rm(staging, {recursive: true, force: true}).catch(() => {});
  }
  progress({phase: "optimize"});
  const fast = await portableStudioFastAdapter(app, true);
  progress({phase: "open"});
  const opened = await portableStudioOpen();
  return {...opened, fast};
}

function portableStudioRegister(trusted) {
  portableGithubIpc.handle("portable:voicestudio-ensure", (event, port) => trusted(event) ? portableStudioEnsure(port) : false);
  portableGithubIpc.handle("portable:voicestudio-status", event => trusted(event) ? portableStudioStatus() : null);
  portableGithubIpc.handle("portable:voicestudio-open", event => trusted(event) ? portableStudioOpen() : null);
  portableGithubIpc.handle("portable:voicestudio-install", event => {
    if (!trusted(event)) return null;
    portableStudioInstallation ??= portableStudioInstall(progress => {
      if (!event.sender.isDestroyed()) event.sender.send("portable:voicestudio-progress", progress);
    }).finally(() => { portableStudioInstallation = undefined; });
    return portableStudioInstallation;
  });
  portableGithubIpc.handle("portable:voicestudio-voices", async (event, port) => {
    if (!trusted(event) || !await portableVoiceStudioCheck(port)) return [];
    try {
      const reply = await portableVoiceStudioRequest(port, "/v1/audio/voices");
      const data = await portableVoiceStudioRead(reply, 512 * 1024);
      const result = data && JSON.parse(data);
      const entries = Array.isArray(result?.voices) ? result.voices : Array.isArray(result?.data) ? result.data : [];
      return entries.slice(0, 100).flatMap(entry => {
        const id = entry?.voice_id ?? entry?.id;
        return typeof id === "string" && id.length > 0 && id.length <= 120 && typeof entry.name === "string"
          ? [{id, name: entry.name.slice(0, 120)}] : [];
      });
    } catch { return []; }
  });
}
