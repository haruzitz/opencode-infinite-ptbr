import { app as portableDiagnosticsApp, dialog as portableDiagnosticsDialog, ipcMain as portableDiagnosticsIpc } from "electron";
import { promises as portableDiagnosticsFs } from "node:fs";
import { join as portableDiagnosticsJoin, resolve as portableDiagnosticsResolve } from "node:path";

const portableDiagnosticKinds = [
  [/\bprovider\.free-limit\b|used today.s free messages/i, "Cota gratuita atingida"],
  [/\b(?:HTTP\s+|status(?:Code)?\s*[:=]\s*|statusCode["']\s*:\s*)429\b|too many requests/i, "HTTP 429 · limite de requisições"],
  [/\bECONNREFUSED\b|unable to connect\b/i, "ECONNREFUSED · conexão recusada"],
  [/\bEADDRINUSE\b|managed service port .+already in use/i, "EADDRINUSE · porta local ocupada"],
  [/\bETIMEDOUT\b|timed out/i, "Tempo de espera excedido"],
  [/\bENOTFOUND\b|\bEAI_AGAIN\b/i, "Falha de DNS"],
  [/\bECONNRESET\b|ERR_CONNECTION_RESET/i, "Conexão interrompida"],
  [/invalid_api_key|incorrect api key|\bHTTP\s+401\b|statusCode\s*[:=]\s*401\b/i, "Falha de autenticação"],
  [/\bHTTP\s+403\b|statusCode\s*[:=]\s*403\b/i, "HTTP 403 · acesso recusado"],
  [/failed to get ['"]documents['"] path/i, "Pasta Documentos indisponível"],
  [/IPC handler failed/i, "Falha de IPC do Desktop"],
  [/render(?:er)?[- ]process[- ]gone|fatal renderer error/i, "Falha no processo da interface"],
];

let portableLastLimitEvent;
portableDiagnosticsIpc.on("portable:diagnostics-limit", (event, delay) => {
  const frame = event.senderFrame;
  if (!frame || frame.parent || frame.url.split(/[?#]/, 1)[0] !== "oc://renderer/index.html") return;
  const at = Date.now();
  const retryAt = Number.isFinite(delay) && delay >= 0 && delay <= 45 * 86400000 ? at + delay : undefined;
  portableLastLimitEvent = {at, retryAt};
});

function portableSummarizeDiagnosticLog(log) {
  const events = [];
  for (const line of log.split(/\r?\n/).reverse()) {
    const header = /^(?:(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)[ \t]+)?\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)\]?/.exec(line);
    const level = header?.[1] ?? (/^\[[^\]\r\n]+\][ \t]+\[(warn|error|fatal)\]/i.exec(line)?.[1]?.toUpperCase());
    const kind = portableDiagnosticKinds.find(([pattern]) => pattern.test(line))?.[1];
    if (kind) events.push((header?.[2] ?? "Horário indisponível") + " · " + kind);
    else if (header && ["WARN", "ERROR", "FATAL"].includes(level)) events.push(header[2] + " · " + level + " · Evento sem classificação");
    if (events.length >= 25) break;
  }
  return events;
}

async function portableReadDiagnosticTail(file) {
  try {
    if (!(await portableDiagnosticsFs.lstat(file)).isFile()) return "";
    const handle = await portableDiagnosticsFs.open(file, "r");
    try {
      const {size} = await handle.stat();
      const bytes = Buffer.alloc(Math.min(size, 256 * 1024));
      const {bytesRead} = await handle.read(bytes, 0, bytes.length, size - bytes.length);
      return bytes.toString("utf8", 0, bytesRead);
    } finally { await handle.close(); }
  } catch { return ""; }
}

async function portableCollectDiagnostics() {
  const profile = portableDiagnosticsResolve(process.resourcesPath, "..", "..", "..", "profile");
  const desktop = portableDiagnosticsApp.getPath("userData");
  const data = process.env.XDG_DATA_HOME || portableDiagnosticsJoin(profile, "data");
  const engine = portableDiagnosticsApp.getVersion();
  const fork = process.env.OPENCODE_INFINITE_VERSION;
  const validVersion = value => /^\d+\.\d+\.\d+$/.test(value ?? "") ? value : "indisponível";
  const report = [
    "Relatório de erro do OpenCode Infinite PT-BR",
    "Gerado em " + new Date().toISOString(),
    "Versão do fork · " + validVersion(fork),
    "OpenCode Desktop · " + validVersion(engine),
  ];
  try {
    const {mode} = JSON.parse(await portableReadDiagnosticTail(portableDiagnosticsJoin(desktop, "infinite.json")));
    const label = new Map([["WARP", "WARP"], ["TOR", "Tor"], ["PROXY", "Proxy"], ["NONE", "Nenhum"]]).get(mode);
    if (label) report.push("Modo selecionado na barra · " + label);
  } catch {}
  if (portableLastLimitEvent) {
    const {at, retryAt} = portableLastLimitEvent;
    report.push("Último aviso de cota nesta execução · " + new Date(at).toISOString());
    if (retryAt !== undefined) report.push("Prazo informado pelo provedor · " + new Date(retryAt).toISOString());
  }
  const logs = portableDiagnosticsJoin(desktop, "logs");
  const runs = await portableDiagnosticsFs.readdir(logs, {withFileTypes: true}).catch(() => []);
  const latest = runs.filter(run => run.isDirectory() && /^\d{8}T\d{6}$/.test(run.name))
    .map(run => run.name).sort().reverse().slice(0, 2);
  const sources = [["Serviço do OpenCode", portableDiagnosticsJoin(data, "opencode", "log", "opencode.log")]];
  for (const run of latest) {
    for (const [file, label] of [["main.log", "Desktop"], ["renderer.log", "Interface"], ["network.log", "Rede"], ["crash.log", "Falhas"]]) {
      sources.push([label + " · " + run, portableDiagnosticsJoin(logs, run, file)]);
    }
  }
  const summaries = await Promise.all(sources.map(async ([label, file]) => {
    const events = portableSummarizeDiagnosticLog(await portableReadDiagnosticTail(file));
    return events.length ? ["", label, ...events] : [];
  }));
  report.push("", "Eventos recentes. Os horários de log sem fuso são locais.");
  if (summaries.some(lines => lines.length)) report.push(...summaries.flat());
  else report.push("Nenhum erro ou aviso recente encontrado nos logs disponíveis.");
  return report.join("\r\n") + "\r\n";
}

async function portableExportDiagnostics() {
  const name = "opencode-relatorio-" + new Date().toISOString().replace(/[:.]/g, "-") + ".txt";
  const result = await portableDiagnosticsDialog.showSaveDialog({
    title: "Exportar relatório de erro",
    defaultPath: name,
    filters: [{name: "Relatório de erro", extensions: ["txt"]}],
  });
  if (result.canceled || !result.filePath) return "";
  const report = await portableCollectDiagnostics();
  await portableDiagnosticsFs.writeFile(result.filePath, "\uFEFF" + report, "utf8");
  return result.filePath;
}
