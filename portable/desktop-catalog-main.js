import { promises as portableCatalogFs } from "node:fs";
import { spawn as portableCatalogSpawn } from "node:child_process";

const portableCatalogRoot = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");

function portableSkillsRoot() {
  const config = process.env.XDG_CONFIG_HOME || portableGitPath.join(portableCatalogRoot, "profile", "config");
  return portableGitPath.join(config, "opencode", "skills");
}

async function portableSkillPresent(id) {
  const path = portableGitPath.join(portableSkillsRoot(), id, "SKILL.md");
  return portableCatalogFs.stat(path).then(file => file.isFile(), () => false);
}

async function portableSkillsList() {
  return Promise.all(portableSkillPacks.map(async ({files, ...pack}) => {
    const skills = Object.keys(files);
    const installed = (await Promise.all(skills.map(portableSkillPresent))).filter(Boolean).length;
    return {...pack, skills, installed};
  }));
}

async function portableSkillsInstall(id) {
  const pack = portableSkillPacks.find(pack => pack.id === id);
  if (!pack) return false;
  const root = portableSkillsRoot();
  await portableCatalogFs.mkdir(root, {recursive: true});
  const staging = await portableCatalogFs.mkdtemp(portableGitPath.join(root, ".catalogo-"));
  try {
    for (const [name, files] of Object.entries(pack.files)) {
      if (await portableSkillPresent(name)) continue;
      const folder = portableGitPath.join(staging, name);
      for (const [file, data] of Object.entries(files)) {
        const destination = portableGitPath.join(folder, file);
        await portableCatalogFs.mkdir(portableGitPath.dirname(destination), {recursive: true});
        await portableCatalogFs.writeFile(destination, Buffer.from(data, "base64"), {flag: "wx"});
      }
      try {
        await portableCatalogFs.rename(folder, portableGitPath.join(root, name));
      } catch (error) {
        if (!await portableSkillPresent(name)) throw error;
      }
    }
    return true;
  } finally {
    await portableCatalogFs.rm(staging, {recursive: true, force: true});
  }
}

const portableSupabaseRef = /^[a-z0-9]{20}$/;
const portableSupabaseName = "supabase";

function portableMcpCommand(args, {timeout = 16000, signal} = {}) {
  const cli = portableGitPath.join(process.resourcesPath, "opencode-cli.exe");
  return new Promise(resolve => {
    portableGitExec(cli, args, {
      cwd: portableCatalogRoot, env: portableGithubWindowsEnv(), windowsHide: true,
      timeout, signal, encoding: "utf8", maxBuffer: 65536,
    }, (error, output) => resolve({ok: !error, output: output ?? ""}));
  });
}

async function portableMcpStatuses() {
  const list = await portableMcpCommand(["api", "mcp.list"]);
  if (!list.ok) return null;
  try {
    const servers = JSON.parse(list.output).data;
    return Object.fromEntries(["github", "supabase", "playwright", "microsoft-learn"].map(name => [
      name, servers.find(server => server.name === name)?.status?.status ?? "not_configured",
    ]));
  } catch { return null; }
}

async function portableSupabaseStatus() {
  return {status: (await portableMcpStatuses())?.supabase ?? "unavailable"};
}

let portableSupabaseAttempt;

async function portableSupabaseConnect(owner, projectRef) {
  if (portableSupabaseAttempt) return "busy";
  if (typeof projectRef !== "string" || (projectRef && !portableSupabaseRef.test(projectRef))) return "invalid";
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const options = {signal: controller.signal};
  portableSupabaseAttempt = {owner, cancel};
  owner.once("destroyed", cancel);
  try {
    if (projectRef) {
      const url = new URL("https://mcp.supabase.com/mcp");
      url.searchParams.set("project_ref", projectRef);
      url.searchParams.set("read_only", "true");
      url.searchParams.set("features", "database,docs");
      const saved = await portableMcpCommand(["mcp", "add", portableSupabaseName, "--global", "--url", url.href], options);
      if (!saved.ok) return controller.signal.aborted ? "cancelled" : "config_failed";
      await portableMcpCommand(["api", "experimental.mcp.add", "--param", "server=" + portableSupabaseName,
        "--data", JSON.stringify({config: {type: "remote", url: url.href}})], options);
    }
    if (controller.signal.aborted) return "cancelled";
    const result = await portableMcpCommand(["mcp", "auth", portableSupabaseName], {...options, timeout: 120000});
    if (controller.signal.aborted) return "cancelled";
    if (result.ok && (await portableSupabaseStatus()).status === "connected") return "connected";
    return "auth_failed";
  } finally {
    owner.removeListener("destroyed", cancel);
    portableSupabaseAttempt = undefined;
  }
}

async function portableWarpExecutable() {
  if (process.platform !== "win32") return;
  for (const directory of new Set([process.env.ProgramW6432, process.env.ProgramFiles].filter(Boolean))) {
    if (!portableGitPath.isAbsolute(directory)) continue;
    const exe = portableGitPath.join(directory, "Cloudflare", "Cloudflare WARP", "Cloudflare WARP.exe");
    if (await portableCatalogFs.stat(exe).then(file => file.isFile(), () => false)) return exe;
  }
}

async function portableWarpAction(action) {
  if (action !== "open") return "failed";
  const exe = await portableWarpExecutable();
  if (!exe) return "missing";
  return new Promise(resolve => {
    const child = portableCatalogSpawn(exe, [], {
      cwd: portableGitPath.dirname(exe), env: portableGithubWindowsEnv(), detached: true, stdio: "ignore",
    });
    child.once("error", () => resolve("failed"));
    child.once("spawn", () => { child.unref(); resolve("opened"); });
  });
}

function portableCatalogRegister(trusted) {
  portableGithubIpc.handle("portable:mcp-statuses", event => trusted(event) ? portableMcpStatuses() : null);
  portableGithubIpc.handle("portable:skills-list", event => trusted(event) ? portableSkillsList() : []);
  portableGithubIpc.handle("portable:skills-install", (event, id) => trusted(event) && portableSkillsInstall(id));
  portableGithubIpc.handle("portable:warp-status", async event => trusted(event) ? {
    installed: Boolean(await portableWarpExecutable()), installing: Boolean(portableWarpInstallation),
  } : null);
  portableGithubIpc.handle("portable:warp-action", (event, action) => {
    if (!trusted(event)) return "failed";
    return action === "install" ? portableWarpInstallFrom(event.sender) : portableWarpAction(action);
  });
  portableGithubIpc.handle("portable:supabase-status", event => trusted(event) ? portableSupabaseStatus() : null);
  portableGithubIpc.handle("portable:supabase-connect", (event, projectRef) =>
    trusted(event) ? portableSupabaseConnect(event.sender, projectRef) : "auth_failed");
  portableGithubIpc.handle("portable:supabase-cancel", event => {
    if (trusted(event) && portableSupabaseAttempt?.owner === event.sender) portableSupabaseAttempt.cancel();
  });
  portableGithubIpc.handle("portable:supabase-logout", async event => {
    if (!trusted(event) || portableSupabaseAttempt) return false;
    return (await portableMcpCommand(["mcp", "logout", portableSupabaseName])).ok;
  });
}
