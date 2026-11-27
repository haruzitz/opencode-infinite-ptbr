import { spawn as portableUpdateSpawn } from "node:child_process";
import { app as portableUpdateApp, net as portableUpdateNet } from "electron";
import { createWriteStream as portableUpdateWrite, promises as portableUpdateFs } from "node:fs";
import { createHash as portableUpdateHash } from "node:crypto";
import { Readable as PortableUpdateReadable, Transform as PortableUpdateTransform } from "node:stream";
import { pipeline as portableUpdatePipeline } from "node:stream/promises";
import { setTimeout as portableUpdateDelay } from "node:timers/promises";

const portableInstalledVersion = "0.3.1";
process.env.OPENCODE_INFINITE_VERSION = portableInstalledVersion;
const portableReleaseApi = "https://api.github.com/repos/haruzitz/opencode-infinite-ptbr/releases";
const portableUpdatePackageName = "OpenCode-Infinite-PTBR-Update.zip";
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
    const expected = "https://github.com/haruzitz/opencode-infinite-ptbr/releases/download/" + release.tag_name + "/" + portableUpdatePackageName;
    const asset = release.assets.find(entry => entry.name === portableUpdatePackageName && entry.browser_download_url === expected &&
      /^sha256:[a-f0-9]{64}$/.test(entry.digest ?? "") && entry.size > 0 && entry.size <= 2 * 1024 ** 3);
    if (asset) return {tag: release.tag_name, url: expected, size: asset.size, digest: asset.digest.slice(7)};
  }
  return null;
}
async function portableDownloadUpdate() {
  const update = await portableUpdateCheck();
  if (!update) return "unavailable";
  const root = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");
  const helper = portableGitPath.join(process.resourcesPath, "portable", "update-worker.exe");
  await portableUpdateFs.access(helper);
  const updates = portableGitPath.join(root, ".updates");
  await portableUpdateFs.mkdir(updates, {recursive: true});
  const staging = await portableUpdateFs.mkdtemp(portableGitPath.join(updates, "download-"));
  const packagePath = portableGitPath.join(staging, "payload.zip");
  let handedOff = false;
  try {
    const response = await portableUpdateNet.fetch(update.url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
    if (!response.ok || !response.body) throw new Error("Falha no download.");
    const hash = portableUpdateHash("sha256");
    let bytes = 0;
    const verify = new PortableUpdateTransform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > update.size) return callback(new Error("Tamanho do pacote inválido."));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await portableUpdatePipeline(PortableUpdateReadable.fromWeb(response.body), verify, portableUpdateWrite(packagePath, {flags: "wx"}));
    if (bytes !== update.size || hash.digest("hex") !== update.digest) throw new Error("A integridade do pacote não confere.");
    const stagedHelper = portableGitPath.join(staging, "update-worker.exe");
    const ready = portableGitPath.join(staging, "ready");
    await portableUpdateFs.copyFile(helper, stagedHelper);
    const child = portableUpdateSpawn(stagedHelper,
      ["--apply-zip", root, String(process.pid), packagePath, update.digest],
      {detached: true, stdio: "ignore", windowsHide: true, cwd: root});
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    const deadline = Date.now() + 120000;
    while (!(await portableUpdateFs.access(ready).then(() => true, () => false))) {
      if (child.exitCode !== null || child.signalCode !== null || Date.now() >= deadline) {
        child.kill();
        throw new Error("O instalador não ficou pronto. Consulte .updates/install.log.");
      }
      await portableUpdateDelay(250);
    }
    handedOff = true;
    child.unref();
    portableUpdateApp.quit();
    return "installing";
  } finally {
    if (!handedOff) await portableUpdateFs.rm(staging, {recursive: true, force: true});
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
