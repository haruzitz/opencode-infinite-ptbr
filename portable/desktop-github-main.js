import { BrowserWindow as PortableGithubWindow, session as portableGithubSessions, shell as portableGithubShell } from "electron";

process.env.OPENCODE_PORTABLE_ROOT = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");

const portableGitExecutable = portableGitPath.join(
  process.env.ProgramFiles || "C:\\Program Files", "Git", "cmd", "git.exe",
);
const portableGitCredentialManager = portableGitPath.resolve(
  portableGitPath.dirname(portableGitExecutable), "..", "mingw64", "bin", "git-credential-manager.exe",
);
const portableGithubPowershell = portableGitPath.join(process.env.SystemRoot || "C:\\Windows",
  "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

function portableGithubWindowsEnv() {
  const environment = { ...process.env };
  for (const variable of ["APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "TEMP", "TMP"]) {
    const real = environment["OPENCODE_WINDOWS_" + variable];
    if (real) environment[variable] = real;
  }
  delete environment.OPENCODE_GITHUB_READ_TOKEN;
  return environment;
}

function portableGit(args, environment = portableGithubWindowsEnv(), executable = portableGitExecutable) {
  return new Promise(resolve => {
    portableGitExec(executable, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      env: environment,
      maxBuffer: 32768,
    }, (error, stdout) => resolve({ ok: !error, output: (stdout ?? "").trim() }));
  });
}

function portableGithubOpenExternal(url) {
  if (url.protocol !== "https:") return Promise.resolve(false);
  if (process.platform !== "win32") return portableGithubShell.openExternal(url.href).then(() => true, () => false);
  return new Promise(resolve => {
    const child = portableGitExec(portableGithubPowershell, [
      "-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference='Stop'; Start-Process -FilePath ([Console]::In.ReadToEnd())",
    ], { env: portableGithubWindowsEnv(), windowsHide: true, timeout: 15000 },
    error => resolve(!error));
    child.stdin.on("error", () => {});
    child.stdin.end(url.href);
  });
}

function portableGithubRepository(url) {
  const scp = /^git@github\.com:([^/]+\/[^/]+)$/i.exec(url);
  let repository = scp?.[1];
  if (!repository) {
    try {
      const address = new URL(url);
      if (!["https:", "ssh:"].includes(address.protocol) || address.hostname !== "github.com" || address.port) return;
      repository = address.pathname.slice(1);
    } catch {
      return;
    }
  }
  repository = repository.replace(/\.git$/i, "");
  return /^[A-Za-z0-9-]+\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(repository) ? repository : undefined;
}

async function portableGithubStatus(directory) {
  const [accounts, webSignedIn, connections] = await Promise.all([
    portableGit(["github", "list"], portableGithubWindowsEnv(), portableGitCredentialManager),
    portableGithubWebStatus(),
    portableMcpStatuses(),
  ]);
  const result = {
    credentialStatusAvailable: accounts.ok,
    webSignedIn,
    mcpStatus: connections?.github ?? "unavailable",
    hasSavedAccount: accounts.ok && accounts.output.split(/\r?\n/).some(
      name => /^[A-Za-z\d](?:[A-Za-z\d-]{0,38})$/.test(name.trim()),
    ),
  };
  if (typeof directory !== "string" || !portableGitPath.isAbsolute(directory)) return result;
  const repo = await portableGit(["-C", directory, "rev-parse", "--show-toplevel"]);
  if (!repo.ok || !repo.output) return result;
  result.isGit = true;
  const [origin, branch] = await Promise.all([
    portableGit(["-C", repo.output, "remote", "get-url", "--push", "--all", "origin"]),
    portableGit(["-C", repo.output, "symbolic-ref", "--quiet", "--short", "HEAD"]),
  ]);
  result.repository = origin.ok ? portableGithubRepository(origin.output) : undefined;
  result.branch = branch.ok ? branch.output : undefined;
  return result;
}

function portableGithubLogin() {
  const child = portableGitExec(portableGitCredentialManager, ["github", "login", "--browser", "--force"], {
    env: portableGithubWindowsEnv(),
    windowsHide: true,
    maxBuffer: 32768,
  });
  let stopReason;
  function stop(reason) {
    if (child.exitCode !== null || stopReason) return;
    stopReason = reason;
    child.kill();
  }
  const timer = setTimeout(() => stop("timeout"), 180000);
  const result = new Promise(resolve => {
    child.once("error", () => resolve(stopReason ?? "failed"));
    child.once("close", code => resolve(stopReason ?? (code === 0 ? "authorized" : "failed")));
  }).finally(() => clearTimeout(timer));
  return { result, cancel: () => stop("cancelled") };
}

const portableGithubPartition = "persist:opencode-github";
const portableGithubSessionCookies = new Set(["user_session", "__Host-user_session_same_site"]);
let portableGithubWebWindow;

async function portableGithubWebStatus() {
  try {
    const cookies = portableGithubSessions.fromPartition(portableGithubPartition).cookies;
    const results = await Promise.all([...portableGithubSessionCookies].map(name =>
      cookies.get({ url: "https://github.com/", name })));
    return results.some(entries => entries.some(cookie => cookie.httpOnly));
  } catch { return null; }
}

function portableGithubOpenWeb(owner, repository, signIn, systemBrowser) {
  const target = repository && portableGithubRepository("https://github.com/" + repository);
  const address = new URL("/" + (target ?? ""), "https://github.com");
  const login = new URL("/login", address);
  login.searchParams.set("return_to", address.pathname);
  const destination = signIn ? login : address;
  if (systemBrowser) return portableGithubOpenExternal(destination);
  const url = destination.href;
  if (portableGithubWebWindow && !portableGithubWebWindow.isDestroyed()) {
    portableGithubWebWindow.focus();
    if (portableGithubWebWindow.webContents.getURL() !== url) {
      void portableGithubWebWindow.loadURL(url).catch(() => {});
    }
    return true;
  }
  const session = portableGithubSessions.fromPartition(portableGithubPartition);
  const win = new PortableGithubWindow({
    parent: PortableGithubWindow.fromWebContents(owner) ?? undefined,
    title: "GitHub — OpenCode",
    width: 1120, height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      session,
      sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true,
    },
  });
  portableGithubWebWindow = win;
  const allowed = address => {
    try { const url = new URL(address); return url.origin === "https://github.com"; }
    catch { return false; }
  };
  const external = address => {
    try {
      const next = new URL(address);
      // Start the Google flow in the browser that will receive GitHub's callback.
      void portableGithubOpenExternal(next.origin === "https://accounts.google.com" ? login : next);
    }
    catch {}
  };
  const guardNavigation = (event, destination) => {
    const address = typeof destination === "string" ? destination : destination?.url ?? event.url;
    if (!allowed(address)) { event.preventDefault(); external(address); }
  };
  win.webContents.on("will-navigate", guardNavigation);
  win.webContents.on("will-redirect", guardNavigation);
  win.webContents.setWindowOpenHandler(({url: address}) => {
    if (allowed(address)) void win.loadURL(address).catch(() => {});
    else external(address);
    return { action: "deny" };
  });
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  const cookies = session.cookies;
  const flush = () => { void cookies.flushStore().catch(() => {}); };
  const onCookie = (_event, cookie) => {
    if (portableGithubSessionCookies.has(cookie.name)) flush();
  };
  cookies.on("changed", onCookie);
  win.on("close", flush);
  win.on("closed", () => {
    cookies.removeListener("changed", onCookie);
    if (portableGithubWebWindow === win) portableGithubWebWindow = undefined;
  });
  void win.loadURL(url).catch(() => { if (!win.isDestroyed()) win.close(); });
  return true;
}

function portableGithubRegister() {
  const trusted = event => {
    const frame = event.senderFrame;
    if (!frame || frame.parent) return false;
    try {
      const url = new URL(frame.url);
      return url.protocol === "oc:" && url.hostname === "renderer" && url.pathname === "/index.html";
    } catch {
      return false;
    }
  };
  portableCatalogRegister(trusted);
  portableGithubIpc.handle("portable:github-web", (event, repository, signIn, systemBrowser) =>
    trusted(event) && portableGithubOpenWeb(event.sender, typeof repository === "string" ? repository : undefined,
      signIn === true, systemBrowser === true));
  portableGithubIpc.handle("portable:github-status", (event, directory) => {
    if (!trusted(event)) return null;
    return portableGithubStatus(directory);
  });
  portableGithubIpc.handle("portable:github-reader", event => {
    if (!trusted(event)) return false;
    const project = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");
    const script = portableGitPath.join(process.resourcesPath, "portable", "Configurar leitura GitHub.ps1");
    return new Promise(resolve => {
      const child = portableGitExec(portableGithubPowershell,
        ["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", script, "-InstallRoot", project],
        { windowsHide: true });
      child.once("spawn", () => resolve(true));
      child.once("error", () => resolve(false));
    });
  });
  let login;
  portableGithubIpc.handle("portable:github-login", async event => {
    if (!trusted(event)) return "failed";
    if (login) return "busy";
    const attempt = portableGithubLogin();
    const owner = event.sender;
    login = { attempt, owner };
    owner.once("destroyed", attempt.cancel);
    try {
      const result = await attempt.result;
      if (result === "authorized") {
        await portableMcpCommand(["api", "experimental.mcp.connect", "--param", "server=github"]);
      }
      return result;
    } finally {
      owner.removeListener("destroyed", attempt.cancel);
      login = undefined;
    }
  });
  portableGithubIpc.handle("portable:github-cancel-login", async event => {
    if (!trusted(event) || login?.owner !== event.sender) return false;
    const { attempt } = login;
    attempt.cancel();
    return await attempt.result === "cancelled";
  });
}
