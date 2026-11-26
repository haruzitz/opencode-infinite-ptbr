"""Offline checks for the egress bridge; no provider accounts or keys."""
import importlib.util
import json
from pathlib import Path
import socket
import socketserver
import tempfile
import threading
import unittest

spec = importlib.util.spec_from_file_location(
    "portable_headroom", Path(__file__).resolve().parents[1] / "portable/headroom-runtime.py"
)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class Echo(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.sendall(self.request.recv(4096))


class Proxy(socketserver.BaseRequestHandler):
    def handle(self):
        self.server.headers.append(runtime.read_headers(self.request))
        self.request.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        self.request.sendall(self.request.recv(4096))


class EgressTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.profile = Path(self.temp.name)
        (self.profile / "desktop").mkdir()
        self.bridge = runtime.TunnelServer(self.profile)
        self.start(self.bridge)

    def tearDown(self):
        self.bridge.shutdown()
        self.bridge.server_close()
        self.temp.cleanup()

    def start(self, server):
        threading.Thread(target=server.serve_forever, daemon=True).start()
        if server is not self.bridge:
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)

    def mode(self, **options):
        (self.profile / "desktop/infinite.json").write_text(json.dumps(options), encoding="utf-8")

    def connect(self, authority):
        sock = socket.create_connection(self.bridge.server_address, timeout=3)
        self.addCleanup(sock.close)
        sock.sendall(f"CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\n\r\n".encode())
        return sock, runtime.read_headers(sock)

    def test_direct_tunnel_preserves_bytes(self):
        server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Echo)
        self.start(server)
        sock, response = self.connect(f"127.0.0.1:{server.server_address[1]}")
        self.assertIn(b"200 Connection Established", response)
        sock.sendall(b"opaque-TLS-bytes")
        self.assertEqual(sock.recv(1024), b"opaque-TLS-bytes")

    def test_proxy_switch_is_read_for_each_connection_and_auth_is_forwarded(self):
        proxies = []
        for _ in range(2):
            proxy = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Proxy)
            proxy.headers = []
            self.start(proxy)
            proxies.append(proxy)
        for proxy in proxies:
            self.mode(mode="PROXY", proxy=f"http://user:password@127.0.0.1:{proxy.server_address[1]}")
            sock, response = self.connect("example.test:443")
            self.assertIn(b"200 Connection Established", response)
            sock.sendall(b"still-encrypted")
            self.assertEqual(sock.recv(1024), b"still-encrypted")
            sock.close()
            self.assertIn(b"CONNECT example.test:443", proxy.headers[0])
            self.assertIn(b"Proxy-Authorization: Basic dXNlcjpwYXNzd29yZA==", proxy.headers[0])
        self.assertEqual([len(p.headers) for p in proxies], [1, 1])

    def test_bad_proxy_configuration_fails_closed(self):
        self.mode(mode="PROXY")
        _, response = self.connect("127.0.0.1:1")
        self.assertIn(b"502 Bad Gateway", response)
        (self.profile / "desktop/infinite.json").write_text("broken", encoding="utf-8")
        _, response = self.connect("127.0.0.1:1")
        self.assertIn(b"502 Bad Gateway", response)

    def test_warp_and_tor_use_desktop_ports(self):
        for mode, port in [("WARP", 40000), ("TOR", 18118)]:
            self.mode(mode=mode)
            self.assertEqual(runtime.selected_proxy(self.profile), f"http://127.0.0.1:{port}")

    def test_only_connect_is_supported(self):
        with socket.create_connection(self.bridge.server_address, timeout=3) as sock:
            sock.sendall(b"GET http://example.test/ HTTP/1.1\r\n\r\n")
            self.assertIn(b"405 Method Not Allowed", runtime.read_headers(sock))


if __name__ == "__main__":
    unittest.main()
