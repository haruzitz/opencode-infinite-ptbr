import { createConnection as portableNetworkConnect } from "node:net";

function portableNetworkPort(value) {
  return Number.isInteger(value) && value > 0 && value <= 65535;
}

function portableLocalProxy(address) {
  try {
    const url = new URL(address);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    const local = host === "localhost" || host === "::1" || /^127\.\d+\.\d+\.\d+$/.test(host);
    if (local && ["http:", "https:"].includes(url.protocol) && portableNetworkPort(port)) return {host, port};
  } catch {}
}

function portableProbeProxy({host, port}) {
  return new Promise(resolve => {
    const socket = portableNetworkConnect({host, port});
    function finish(reachable) {
      socket.destroy();
      resolve(reachable);
    }
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(900, () => finish(false));
  });
}

async function portableProxyStatus(mode, target) {
  const reachable = await portableProbeProxy(target);
  const name = mode === "WARP" ? "Proxy local do WARP" : "Proxy local";
  const port = " na porta " + target.port;
  if (reachable) return {ok: true, message: name + " disponível" + port + "."};
  const recovery = mode === "WARP" ? " Abra o Cloudflare One Client e confira o modo Proxy local."
    : " Inicie o proxy ou confira a porta em Configurações.";
  return {ok: false, message: name + " indisponível" + port + "." + recovery};
}

async function portablePrepareNetworkMode(mode, manualProxy) {
  if (mode === "PROXY") {
    const target = portableLocalProxy(manualProxy);
    if (target) return {proxy: manualProxy, ...await portableProxyStatus(mode, target)};
  }
  if (mode !== "WARP") return;
  const settings = await Wv("settings");
  const port = Number(/\bWarpProxy\s+on\s+port\s+(\d+)\b/i.exec(settings.out)?.[1]);
  if (!settings.ok || !portableNetworkPort(port)) {
    return {ok: false, message: "Abra o Cloudflare One Client e conecte no modo Proxy local antes de selecionar WARP."};
  }
  return {port, ...await portableProxyStatus(mode, {host: "127.0.0.1", port})};
}

function portableSelectedProxyStatus(mode) {
  const target = (mode === "WARP" || mode === "PROXY") && portableLocalProxy(Bv());
  return target ? portableProxyStatus(mode, target) : by();
}
