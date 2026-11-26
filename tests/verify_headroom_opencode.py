"""Real OpenCode + real Headroom + local HTTPS/SSE provider. No live keys.

Run with profile/headroom/venv/Scripts/python.exe tests/verify_headroom_opencode.py.
Artifacts are written below the ignored downloads/headroom-proof directory.
"""
import datetime
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import ProxyHandler, Request, build_opener

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from headroom.providers.opencode.runtime import headroom_opencode_plugin_path

ROOT = Path(__file__).resolve().parents[1]
case = ROOT / "downloads" / "headroom-proof" / str(time.time_ns())
case.mkdir(parents=True)
profile = case / "profile"
(profile / "headroom").mkdir(parents=True)
work = case / "work"
work.mkdir()
records = []


class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        records.append({"path": self.path, "headers": dict(self.headers), "body": body})
        if self.path != "/v1/chat/completions":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()
        for delta, finish in [({"role": "assistant", "content": "HEADROOM_RUNTIME_OK"}, None), ({}, "stop")]:
            chunk = {"id": "proof", "object": "chat.completion.chunk", "created": 1,
                     "model": body["model"], "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
            self.wfile.write(("data: " + json.dumps(chunk) + "\n\n").encode())
            self.wfile.flush()
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()


key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Headroom local test")])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=1))
        .not_valid_after(now + datetime.timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("headroom-proof.test")]), critical=False)
        .sign(key, hashes.SHA256()))
cert_path, key_path = case / "cert.pem", case / "key.pem"
cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
upstream = ThreadingHTTPServer(("127.0.0.2", 0), Upstream)
upstream.daemon_threads = True
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain(cert_path, key_path)
upstream.socket = tls.wrap_socket(upstream.socket, server_side=True)
threading.Thread(target=upstream.serve_forever, daemon=True).start()
with socket.socket() as free_port:
    free_port.bind(("127.0.0.1", 0))
    port = free_port.getsockname()[1]
(profile / "headroom/settings.json").write_text(json.dumps({"enabled": True, "port": port}))
env = {k: v for k, v in os.environ.items() if k.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "COMSPEC"}}
for variable, directory in [("USERPROFILE", "home"), ("HOME", "home"), ("APPDATA", "appdata"),
                            ("LOCALAPPDATA", "localappdata"), ("TEMP", "tmp"), ("TMP", "tmp"),
                            ("XDG_DATA_HOME", "data"), ("XDG_CONFIG_HOME", "config"),
                            ("XDG_CACHE_HOME", "cache"), ("XDG_STATE_HOME", "state")]:
    target = case / directory
    target.mkdir(exist_ok=True)
    env[variable] = str(target)
env.update({"HEADROOM_ALLOWED_BASE_URLS": "headroom-proof.test", "SSL_CERT_FILE": str(cert_path),
            "HEADROOM_BEACON": "off", "OPENCODE_DISABLE_MODELS_FETCH": "1",
            "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"})
# Map only the fixture name inside the test proxy process. The plugin sees a
# remote-shaped name; a bypassed OpenCode request cannot resolve it and fails.
(case / "sitecustomize.py").write_text(
    "import socket\n_original = socket.getaddrinfo\n"
    "def lookup(host, *args, **kwargs):\n"
    "    return _original('127.0.0.2' if host in ('headroom-proof.test', b'headroom-proof.test') else host, *args, **kwargs)\n"
    "socket.getaddrinfo = lookup\n"
)
env["PYTHONPATH"] = str(case)
# Reuse only public tokenizer data; no credentials or history from the user profile.
import shutil
shutil.copytree(ROOT / "profile/headroom/cache/tiktoken", profile / "headroom/cache/tiktoken")
config = {
    "update": "disable", "share": "disabled", "snapshots": False, "model": "proof/gpt-4o",
    "providers": {"proof": {"package": "@opencode/ai/providers/openai-compatible", "name": "Local proof",
        "settings": {"baseURL": f"https://headroom-proof.test:{upstream.server_port}/v1", "apiKey": "local-proof-only"},
        "models": {"gpt-4o": {"name": "Local proof", "limit": {"context": 128000, "output": 512},
            "capabilities": {"tools": False, "input": ["text"], "output": ["text"]}}}}},
    "plugins": [{"package": headroom_opencode_plugin_path(), "options": {"proxyUrl": f"http://127.0.0.1:{port}"}}],
}
(work / "opencode.json").write_text(json.dumps(config))
opener = build_opener(ProxyHandler({}))
proxy_log = (case / "proxy.log").open("w", encoding="utf-8")
process = subprocess.Popen([sys.executable, str(ROOT / "portable/headroom-runtime.py"),
                            "--profile", str(profile), "--port", str(port)], env=env,
                           stdout=proxy_log, stderr=subprocess.STDOUT)
try:
    for _ in range(90):
        if process.poll() is not None:
            raise RuntimeError(f"Headroom failed; see {case}")
        try:
            with opener.open(f"http://127.0.0.1:{port}/portable-health", timeout=1):
                break
        except OSError:
            time.sleep(1)
    else:
        raise RuntimeError("Headroom startup timed out")
    rows = [{"id": i, "status": "ok", "region": "br", "message": "routine successful operation"} for i in range(250)]
    messages = [{"role": "user", "content": "Find failures in these results"},
                {"role": "assistant", "content": None, "tool_calls": [{"id": "audit", "type": "function",
                 "function": {"name": "read_results", "arguments": "{}"}}]},
                {"role": "tool", "tool_call_id": "audit", "content": json.dumps(rows)},
                {"role": "user", "content": "Report the result"}]
    request = Request(f"http://127.0.0.1:{port}/v1/compress", method="POST",
                      data=json.dumps({"model": "gpt-4o", "messages": messages}).encode(),
                      headers={"Content-Type": "application/json"})
    with opener.open(request, timeout=30) as response:
        compression = json.load(response)
    assert compression["tokens_saved"] > 0, "Repeated tool output was not compressed"
    assert compression["messages"][0] == messages[0] and compression["messages"][-1] == messages[-1]
    result = subprocess.run([str(ROOT / "apps/OpenCode/resources/opencode-cli.exe"), "run", "--standalone",
                             "--format", "json", "Reply with HEADROOM_RUNTIME_OK."], cwd=work, env=env,
                            text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=90)
    (case / "opencode.log").write_text(result.stdout + "\n" + result.stderr, encoding="utf-8")
    assert result.returncode == 0, f"OpenCode failed: {case}"
    assert "HEADROOM_RUNTIME_OK" in result.stdout, f"No streamed answer: {case}"
    assert records, f"Provider received no requests: {case}"
    assert all(r["path"] == "/v1/chat/completions" for r in records)
    assert all(not any(k.lower().startswith("x-headroom-") for k in r["headers"]) for r in records)
    assert all(next((v for k, v in r['headers'].items() if k.lower() == 'authorization'), '') == 'Bearer local-proof-only' for r in records)
    proxy_text = (case / "proxy.log").read_text(encoding="utf-8", errors="replace")
    assert "proxy_inbound_request" in proxy_text and "/v1/chat/completions" in proxy_text, f"Proxy was bypassed: {case}"
    summary = {"result": "PASS", "provider_requests": len(records), "sse_response": "HEADROOM_RUNTIME_OK",
               "compression": {key: compression[key] for key in ("tokens_before", "tokens_after", "tokens_saved")},
               "logs": str(case)}
    (case / "result.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary))
finally:
    (profile / "headroom/settings.json").write_text('{"enabled":false}')
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.terminate()
        process.wait(timeout=10)
    upstream.shutdown()
    upstream.server_close()
    proxy_log.close()
