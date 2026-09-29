"""Run the browser suite against the generated publish artifact."""

import os
import subprocess
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread


root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
if not (dist / 'index.html').is_file():
    raise SystemExit('dist/ is missing; run npm run build first')

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


handler = partial(QuietHandler, directory=str(dist))
with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    environment = dict(os.environ, BASE_URL=f'http://127.0.0.1:{server.server_port}')
    try:
        raise SystemExit(subprocess.call(['node', '--test', 'tests/core-pages.cjs'], cwd=root, env=environment))
    finally:
        server.shutdown()
