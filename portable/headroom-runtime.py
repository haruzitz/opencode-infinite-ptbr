"""Local Headroom host. Keep OpenCode's selected egress outside compression.

No provider keys are read here. HTTPS travels through CONNECT tunnels; the
existing desktop/infinite.json chooses the tunnel for each new connection.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import select
import socket
import socketserver
import threading
import time
from urllib.parse import unquote, urlsplit


def selected_proxy(profile: Path) -> str | None:
    path = profile / "desktop" / "infinite.json"
    options = json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else {}
    if not isinstance(options, dict):
        raise ValueError("Configuração de rede deve ser um objeto JSON")
    mode = options.get("mode", "NONE")
    if mode == "NONE":
        return None
    if mode == "WARP":
        return "http://127.0.0.1:40000"
    if mode == "TOR":
        return "http://127.0.0.1:18118"
    if mode != "PROXY" or not options.get("proxy"):
        raise ValueError("Modo de rede inválido ou proxy ainda não selecionado")
    proxy = options["proxy"]
    parsed = urlsplit(proxy)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or not parsed.port:
        raise ValueError("Proxy HTTP(S) inválido")
    return proxy


def read_headers(stream: socket.socket) -> bytes:
    data = bytearray()
    while b"\r\n\r\n" not in data:
        chunk = stream.recv(1)
        if not chunk:
            raise ConnectionError("Conexão encerrada antes dos cabeçalhos")
        data.extend(chunk)
        if len(data) > 65536:
            raise ValueError("Cabeçalhos grandes demais")
    return bytes(data)


def open_tunnel(profile: Path, authority: str) -> socket.socket:
    destination = urlsplit("//" + authority)
    if not destination.hostname or not destination.port or destination.username or destination.path:
        raise ValueError("Destino CONNECT inválido")
    proxy = selected_proxy(profile)
    if proxy is None:
        return socket.create_connection((destination.hostname, destination.port), timeout=20)
    parsed = urlsplit(proxy)
    stream = socket.create_connection((parsed.hostname, parsed.port), timeout=20)
    try:
        if parsed.scheme == "https":
            import ssl
            stream = ssl.create_default_context().wrap_socket(stream, server_hostname=parsed.hostname)
        headers = f"CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\n"
        if parsed.username is not None:
            credentials = unquote(parsed.username) + ":" + unquote(parsed.password or "")
            auth = base64.b64encode(credentials.encode()).decode("ascii")
            headers += f"Proxy-Authorization: Basic {auth}\r\n"
        stream.sendall((headers + "\r\n").encode("ascii"))
        status = read_headers(stream).split(b"\r\n", 1)[0].split()
        if len(status) < 2 or status[1] != b"200":
            raise ConnectionError("O proxy selecionado recusou o túnel")
        return stream
    except Exception:
        stream.close()
        raise


class TunnelHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(20)
        connected = False
        try:
            line = read_headers(self.request).split(b"\r\n", 1)[0].decode("ascii")
            method, authority, version = line.split()
            if method != "CONNECT" or version not in {"HTTP/1.0", "HTTP/1.1"}:
                self.request.sendall(b"HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n")
                return
            with open_tunnel(self.server.profile, authority) as upstream:
                self.request.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                connected = True
                sockets = [self.request, upstream]
                while True:
                    readable, _, _ = select.select(sockets, [], [], 120)
                    if not readable:
                        return
                    for source in readable:
                        data = source.recv(65536)
                        if not data:
                            return
                        (upstream if source is self.request else self.request).sendall(data)
        except (OSError, ValueError, KeyError):
            # Do not print destination URLs, proxy passwords or request headers.
            if not connected:
                try:
                    self.request.sendall(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n")
                except OSError:
                    pass


class TunnelServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, profile: Path):
        self.profile = profile
        super().__init__(("127.0.0.1", 0), TunnelHandler)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    profile = args.profile.resolve()
    runtime = profile / "headroom"
    runtime.mkdir(parents=True, exist_ok=True)
    # Set these before importing Headroom. Compression requires no model download.
    os.environ.update({
        "HEADROOM_MODE": "token",
        "HEADROOM_DISABLE_KOMPRESS": "true",
        "HEADROOM_DISABLE_KOMPRESS_FALLBACK": "true",
        "HEADROOM_BEACON": "off",
        "HEADROOM_COMPRESS_USER_MESSAGES": "false",
        "HEADROOM_COMPRESS_SYSTEM_MESSAGES": "false",
        "HEADROOM_MEMORY_ENABLED": "false",
        "HEADROOM_LOG_MESSAGES": "false",
        "HEADROOM_CACHE_DIR": str(runtime / "cache"),
        "HEADROOM_CONFIG_DIR": str(runtime / "config"),
        "HEADROOM_WORKSPACE_DIR": str(runtime / "workspace"),
        "HF_HOME": str(runtime / "cache" / "huggingface"),
        "HF_HUB_OFFLINE": "1",
        "LITELLM_LOCAL_MODEL_COST_MAP": "true",
        "TIKTOKEN_CACHE_DIR": str(runtime / "cache" / "tiktoken"),
        # New CONNECTs follow mode changes. Do not reuse provider connections
        # across the desktop's explicit network resets.
        "HEADROOM_MAX_KEEPALIVE": "0",
        "HEADROOM_HOST": "127.0.0.1",
        "HEADROOM_PORT": str(args.port),
    })
    bridge = TunnelServer(profile)
    os.environ["HEADROOM_HTTP_PROXY"] = f"http://127.0.0.1:{bridge.server_address[1]}"
    threading.Thread(target=bridge.serve_forever, daemon=True).start()
    try:
        import uvicorn
        from starlette.responses import JSONResponse
        from headroom.agent_savings import seed_proxy_env_defaults
        from headroom.proxy.server import create_app, _proxy_config_from_env

        seed_proxy_env_defaults()
        config = _proxy_config_from_env()
        config.cache_enabled = False
        config.rate_limit_enabled = False
        config.subscription_tracking_enabled = False
        app = create_app(config)

        # Middleware precedes Headroom's catch-all provider route.
        @app.middleware("http")
        async def portable_health(request, call_next):
            if request.method == "GET" and request.url.path == "/portable-health":
                return JSONResponse({"service": "headroom-proxy", "portable_profile": str(profile)})
            return await call_next(request)

        config = uvicorn.Config(app, host="127.0.0.1", port=args.port, access_log=False)
        server = uvicorn.Server(config)

        def watch_settings():
            while not server.should_exit:
                time.sleep(2)
                try:
                    settings = json.loads((runtime / "settings.json").read_text(encoding="utf-8-sig"))
                    if not settings.get("enabled") or settings.get("port") != args.port:
                        server.should_exit = True
                except (OSError, ValueError):
                    # Atomic saves/temporary failures must not kill active requests.
                    pass

        threading.Thread(target=watch_settings, daemon=True).start()
        server.run()
    finally:
        bridge.shutdown()
        bridge.server_close()


if __name__ == "__main__":
    main()
