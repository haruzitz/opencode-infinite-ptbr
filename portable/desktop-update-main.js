import { spawn as portableUpdateSpawn } from "node:child_process";
import { app as portableUpdateApp, dialog as portableUpdateDialog, net as portableUpdateNet, shell as portableUpdateShell } from "electron";
import { createWriteStream as portableUpdateWrite, promises as portableUpdateFs } from "node:fs";
import { createHash as portableUpdateHash } from "node:crypto";
import { Readable as PortableUpdateReadable, Transform as PortableUpdateTransform } from "node:stream";
import { pipeline as portableUpdatePipeline } from "node:stream/promises";

const portableInstalledVersion = "0.2.2";
const portableReleaseApi = "https://api.github.com/repos/haruzitz/opencode-infinite-ptbr/releases";
const portableInstallerName = "OpenCode-Infinite-PTBR-Setup.exe";
let portableUpdateJob;
function portableUpdateVersion(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag ?? "");
  return match?.slice(1).map(Number);
}
function portableUpdateCompare(a, b) {
  const left = portableUpdateVersion(a);
  const right = portableUpdateVersion(b);
  if (!left || !right) return 0;
  return left.reduce((result, part, index) => result || Math.sign(part - right[index]), 0);
}
async function portableUpdateCheck() {
  const response = await portableUpdateNet.fetch(portableReleaseApi + "?per_page=30", { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("O GitHub não respondeu à consulta de atualizações.");
  const releases = await response.json();
  const candidates = releases.filter(release => !release.draft && !release.prerelease &&
    release.author?.login.toLowerCase() === "haruzitz" && portableUpdateCompare(release.tag_name, portableInstalledVersion) > 0);
  candidates.sort((a, b) => portableUpdateCompare(b.tag_name, a.tag_name));
  for (const release of candidates) {
    const expected = "https://github.com/haruzitz/opencode-infinite-ptbr/releases/download/" + release.tag_name + "/" + portableInstallerName;
    const asset = release.assets.find(entry => entry.name === portableInstallerName && entry.browser_download_url === expected &&
      /^sha256:[a-f0-9]{64}$/.test(entry.digest ?? "") && entry.size > 0 && entry.size <= 2 * 1024 ** 3);
    if (asset) return {tag: release.tag_name, url: expected, size: asset.size, digest: asset.digest.slice(7)};
  }
  return null;
}
async function portableDownloadUpdate() {
  const update = await portableUpdateCheck();
  if (!update) return "unavailable";
  const result = await portableUpdateDialog.showSaveDialog({
    title: "Salvar atualização " + update.tag,
    defaultPath: portableGitPath.join(portableUpdateApp.getPath("downloads"), portableInstallerName),
    filters: [{name: "Instalador do OpenCode", extensions: ["exe"]}],
  });
  if (result.canceled || !result.filePath) return "cancelled";
  const path = result.filePath;
  const temporary = path + "." + process.pid + ".part";
  try {
    const response = await portableUpdateNet.fetch(update.url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
    if (!response.ok || !response.body) throw new Error("Falha no download.");
    const hash = portableUpdateHash("sha256");
    let bytes = 0;
    const verify = new PortableUpdateTransform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > update.size) return callback(new Error("Tamanho do instalador inválido."));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await portableUpdatePipeline(PortableUpdateReadable.fromWeb(response.body), verify, portableUpdateWrite(temporary, {flags: "wx"}));
    if (bytes !== update.size || hash.digest("hex") !== update.digest) throw new Error("A integridade do instalador não confere.");
    await portableUpdateFs.rename(temporary, path);
    const confirmation = await portableUpdateDialog.showMessageBox({
      type: "question", title: "Atualização do OpenCode",
      message: "Atualização verificada. Instalar e reabrir o OpenCode agora?",
      detail: "O perfil, o histórico e os projetos serão preservados.",
      buttons: ["Instalar e reabrir", "Instalar depois"], defaultId: 1, cancelId: 1,
    });
    if (confirmation.response === 0) {
      const root = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");
      const child = portableUpdateSpawn(path, ["--update", root, String(process.pid)], { detached: true, stdio: "ignore", windowsHide: true });
      await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
      child.unref();
      portableUpdateApp.quit();
      return "installing";
    }
    portableUpdateShell.showItemInFolder(path);
    return "saved";
  } finally {
    await portableUpdateFs.rm(temporary, {force: true});
  }
}
function portableUpdateRegister() {
  const trusted = event => !event.senderFrame?.parent && event.senderFrame?.url.split(/[?#]/)[0] === "oc://renderer/index.html";
  portableGithubIpc.handle("portable:update-check", async event => {
    if (!trusted(event)) return null;
    const update = await portableUpdateCheck();
    return { installed: portableInstalledVersion, available: update?.tag ?? null };
  });
  portableGithubIpc.handle("portable:update-download", async event => {
    if (!trusted(event)) return "unavailable";
    if (portableUpdateJob) return "busy";
    portableUpdateJob = portableDownloadUpdate();
    try { return await portableUpdateJob; } finally { portableUpdateJob = undefined; }
  });
}
portableUpdateRegister();
