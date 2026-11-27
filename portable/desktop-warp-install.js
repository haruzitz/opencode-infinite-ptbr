import { createWriteStream as portableWarpWrite } from "node:fs";
import { pipeline as portableWarpPipeline } from "node:stream/promises";

const portableWarpDownloadUrl = "https://downloads.cloudflareclient.com/v1/download/windows/ga";
const portableWarpMaxBytes = 256 * 1024 * 1024;

async function portableWarpDownloadPackage(file, progress, fetchPackage = portableLiveNet.fetch.bind(portableLiveNet)) {
  const response = await fetchPackage(portableWarpDownloadUrl, {signal: AbortSignal.timeout(10 * 60 * 1000)});
  if (!response.ok || !response.body) throw new Error("Download incompleto");
  const endpoint = new URL(response.url);
  const total = Number(response.headers.get("content-length"));
  if (endpoint.origin !== "https://downloads.cloudflareclient.com" || total > portableWarpMaxBytes) {
    await response.body.cancel();
    throw new Error("O download da Cloudflare respondeu de forma inesperada");
  }
  let bytes = 0;
  let last = -1;
  progress({phase: "download"});
  await portableWarpPipeline(response.body, async function* (source) {
    for await (const chunk of source) {
      bytes += chunk.byteLength;
      if (bytes > portableWarpMaxBytes) throw new Error("Instalador acima do tamanho esperado");
      const percent = total > 0 ? Math.min(100, Math.floor(bytes / total * 100)) : -1;
      if (percent > last) {
        last = percent;
        progress({phase: "download", percent});
      }
      yield chunk;
    }
  }, portableWarpWrite(file, {flags: "wx"}));
  if (!bytes || (total > 0 && bytes !== total)) throw new Error("Download incompleto");
}

const portableWarpMsiCommand = `
$ErrorActionPreference = 'Stop'
$installer = $env:OPENCODE_WARP_MSI
$handle = $null
try {
  Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1')
  # Keep the verified MSI read-only through elevation and installation.
  $handle = [IO.File]::Open($installer, 'Open', 'Read', 'Read')
  $signature = Get-AuthenticodeSignature -LiteralPath $installer
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.GetNameInfo('SimpleName', $false) -ne 'Cloudflare, Inc.') { exit 3 }
  [Console]::WriteLine('verified')
  [Console]::Out.Flush()
  $msiExec = Join-Path $env:SystemRoot 'System32\\msiexec.exe'
  $parameters = '/i "' + $installer + '" /quiet /norestart'
  $operation = Start-Process -FilePath $msiExec -ArgumentList $parameters -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  exit $operation.ExitCode
} catch {
  $cause = $_.Exception
  while ($cause) {
    if ($cause -is [ComponentModel.Win32Exception] -and $cause.NativeErrorCode -eq 1223) { exit 1223 }
    $cause = $cause.InnerException
  }
  exit 1
} finally {
  if ($handle) { $handle.Dispose() }
}
`;

function portableWarpRunMsi(file, progress) {
  const powershell = portableGitPath.join(process.env.SystemRoot || "C:\\Windows",
    "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const command = Buffer.from(portableWarpMsiCommand, "utf16le").toString("base64");
  return new Promise(resolve => {
    const child = portableCatalogSpawn(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", command], {
      env: {...portableGithubWindowsEnv(), OPENCODE_WARP_MSI: file},
      windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      const verified = stdout.includes("verified");
      stdout += chunk;
      if (!verified && stdout.includes("verified")) progress({phase: "install"});
    });
    child.once("error", () => resolve(1));
    child.once("close", code => resolve(code ?? 1));
  });
}

async function portableWarpInstall(progress) {
  if (process.platform !== "win32") return "unsupported";
  if (await portableWarpExecutable()) return "installed";
  const temp = portableGitPath.join(portableCatalogRoot, "profile", "temp");
  await portableCatalogFs.mkdir(temp, {recursive: true});
  const staging = await portableCatalogFs.mkdtemp(portableGitPath.join(temp, "warp-"));
  try {
    const file = portableGitPath.join(staging, "Cloudflare-WARP.msi");
    try { await portableWarpDownloadPackage(file, progress); }
    catch { return "download_failed"; }
    progress({phase: "verify"});
    const code = await portableWarpRunMsi(file, progress);
    if (code === 3) return "signature_failed";
    if (code === 1602 || code === 1223) return "cancelled";
    if (code === 1618) return "windows_busy";
    if (code === 3010 || code === 1641) return "reboot_required";
    return code === 0 && await portableWarpExecutable() ? "installed" : "failed";
  } finally {
    await portableCatalogFs.rm(staging, {recursive: true, force: true}).catch(() => {});
  }
}

let portableWarpInstallation;

function portableWarpInstallFrom(owner) {
  portableWarpInstallation ??= portableWarpInstall(value => {
    if (!owner.isDestroyed()) owner.send("portable:warp-progress", value);
  }).finally(() => { portableWarpInstallation = undefined; });
  return portableWarpInstallation;
}
