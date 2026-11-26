const portableGitExecutable = portableGitPath.join(
  process.env.ProgramFiles || "C:\\Program Files", "Git", "cmd", "git.exe",
);
const portableGitCredentialManager = portableGitPath.resolve(
  portableGitPath.dirname(portableGitExecutable), "..", "mingw64", "bin", "git-credential-manager.exe",
);

function portableGithubWindowsEnv() {
  const environment = { ...process.env };
  for (const variable of ["APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "TEMP", "TMP"]) {
    const real = environment["OPENCODE_WINDOWS_" + variable];
    if (real) environment[variable] = real;
  }
  delete environment.OPENCODE_GITHUB_READ_TOKEN;
  return environment;
}

function portableGit(args, environment) {
  return new Promise(resolve => {
    portableGitExec(portableGitExecutable, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      env: environment,
      maxBuffer: 32768,
    }, (error, stdout) => resolve({ ok: !error, output: (stdout ?? "").trim() }));
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
  const accounts = await portableGit(["credential-manager", "github", "list"], portableGithubWindowsEnv());
  const result = {
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
  portableGithubIpc.handle("portable:github-status", (event, directory) => {
    if (!trusted(event)) return null;
    return portableGithubStatus(directory);
  });
  portableGithubIpc.handle("portable:github-reader", event => {
    if (!trusted(event)) return false;
    const project = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");
    const script = portableGitPath.join(project, "portable", "Configurar leitura GitHub.ps1");
    const powershell = portableGitPath.join(process.env.SystemRoot || "C:\\Windows",
      "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    return new Promise(resolve => {
      const child = portableGitExec(powershell,
        ["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", script],
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
      return await attempt.result;
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
