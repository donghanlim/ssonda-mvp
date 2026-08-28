from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from subprocess import run, PIPE
import os
import socket

ROOT = Path(__file__).parent

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        return str(ROOT / path.lstrip('/').split('?')[0])

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/qr':
            value = parse_qs(parsed.query).get('data', [''])[0]
            if not value or len(value) > 1800:
                self.send_error(400, 'QR data is missing or too long')
                return
            output = run(['node', str(ROOT / 'qr.cjs'), value], cwd=ROOT, stdout=PIPE, stderr=PIPE, text=True, timeout=10)
            if output.returncode:
                self.send_error(500, output.stderr[:200])
                return
            body = output.stdout.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()


def start_server():
    requested = os.environ.get('PORT')
    ports = [int(requested)] if requested else range(4174, 4185)
    last_error = None
    for port in ports:
        try:
            return ThreadingHTTPServer(('0.0.0.0', port), Handler), port
        except OSError as error:
            last_error = error
            if error.errno != 48:  # Address already in use
                raise
    raise RuntimeError(f'Ports {list(ports)} are unavailable. Set PORT to another free port.') from last_error


if __name__ == '__main__':
    os.chdir(ROOT)
    server, port = start_server()
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        try:
            probe.connect(('8.8.8.8', 80))
            local_ip = probe.getsockname()[0]
        except OSError:
            local_ip = 'your-mac-local-ip'
    print(f'SSONDA MVP local: http://127.0.0.1:{port}')
    print(f'Same Wi-Fi phone test: http://{local_ip}:{port}')
    server.serve_forever()
