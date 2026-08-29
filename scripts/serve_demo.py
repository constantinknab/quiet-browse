"""Loopback-only fixture server. Never serves the home directory or accepts writes."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        route = urlsplit(self.path).path
        if route == '/demo/tests.html':
            source = (ROOT / 'demo/index.html').read_text()
            source = source.replace('</body>', '<script src="harness.js"></script><script src="/extension/shared/comfort.js"></script><script src="/extension/content/comfort.js"></script><script src="/extension/content/social.js"></script><script src="/extension/content/engine.js"></script><script src="browser-tests.js"></script></body>')
            return self.html(source)
        if route == '/demo/youtube-tests.html':
            return self.html((ROOT / 'demo/youtube.html').read_text())
        if route == '/demo/engine-youtube.js':
            # Fixture-only host adapter. Packaged engine is unchanged; no real YouTube claim.
            source = "(() => { const location = { hostname: 'www.youtube.com' };\n" + (ROOT / 'extension/content/engine.js').read_text() + '\n})();'
            return self.reply(source, 'text/javascript; charset=utf-8')
        if route == '/demo/social-tests.html':
            return self.html((ROOT / 'demo/social.html').read_text())
        if route == '/demo/social-instagram.js':
            source = "(() => { const location = { hostname: 'www.instagram.com', get pathname() { return window.fixturePath || '/'; }, get href() { return 'https://www.instagram.com' + this.pathname; } };\n" + (ROOT / 'extension/content/social.js').read_text() + '\n})();'
            return self.reply(source, 'text/javascript; charset=utf-8')
        if route in ('/demo/popup.html', '/demo/options.html', '/demo/popup-tests.html', '/demo/options-tests.html'):
            page = 'popup.html' if '/popup' in route else 'options.html'
            source = (ROOT / 'extension/ui' / page).read_text()
            source = source.replace('<head>', '<head><base href="/extension/ui/"><script src="/demo/ui-shim.js"></script>')
            source = source.replace('<main>', '<main><p class="notice">UI test preview — Chrome permissions are simulated here.</p>')
            if '-tests.html' in route:
                source = source.replace('</body>', '<script type="module" src="/demo/ui-tests.js"></script></body>')
            return self.html(source)
        # Only these task-owned public assets are reachable, even if more files are added.
        if not route.startswith(('/demo/', '/extension/')) or '..' in route:
            self.send_error(404)
            return
        return super().do_GET()

    def reply(self, source, content_type):
        encoded = source.encode()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(encoded)

    def html(self, source):
        return self.reply(source, 'text/html; charset=utf-8')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    print('Quiet Browse local lab: http://127.0.0.1:8674/demo/index.html', flush=True)
    print('Automated DOM fixtures: /demo/tests.html, /demo/youtube-tests.html, /demo/social-tests.html, /demo/comfort.html', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', 8674), Handler).serve_forever()
    except KeyboardInterrupt:
        print('\nLocal test server stopped.')
