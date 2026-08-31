"""Loopback-only fixture server. Never serves the home directory or accepts writes."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import re

ROOT = Path(__file__).resolve().parents[1]
LIFECYCLE_PROFILES = {
    'instagram': ('www.instagram.com', 'social', 'Instagram', '/reels/'),
    'facebook': ('www.facebook.com', 'social', 'Facebook', '/watch/'),
    'tiktok': ('www.tiktok.com', 'social', 'TikTok', '/following/'),
    'amazon': ('www.amazon.com', 'ecommerce', 'Amazon', '/video/'),
    'ebay': ('www.ebay.com', 'ecommerce', 'eBay', '/video/'),
    'etsy': ('www.etsy.com', 'ecommerce', 'Etsy', '/video/'),
    'walmart': ('www.walmart.com', 'ecommerce', 'Walmart', '/video/'),
    'target': ('www.target.com', 'ecommerce', 'Target', '/video/'),
    'temu': ('www.temu.com', 'ecommerce', 'Temu', '/video/'),
    'shein': ('us.shein.com', 'ecommerce', 'Shein', '/video/'),
    'aliexpress': ('www.aliexpress.com', 'ecommerce', 'AliExpress', '/video/'),
    'youtube': ('www.youtube.com', 'youtube', 'YouTube', '/shorts/'),
}


def wrapped_extension_script(location_source, target_path):
    """Wrap an extension script with a fixture-only location object."""

    return f"(() => {{ {location_source}\n{target_path.read_text()}\n}})();"


class FixtureRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        route = urlsplit(self.path).path
        lifecycle = re.fullmatch(r'/demo/lifecycle-([a-z]+)\.html', route)
        if lifecycle and lifecycle.group(1) in LIFECYCLE_PROFILES:
            profile = lifecycle.group(1)
            host, group, label, short_path = LIFECYCLE_PROFILES[profile]
            source = (ROOT / 'demo/lifecycle.html').read_text()
            replacements = {
                '__PROFILE__': profile,
                '__GROUP__': group,
                '__LABEL__': label,
                '__SHORT_PATH__': short_path,
                '__SHORT_SURFACE__': (
                    '' if profile == 'tiktok' else 'data-qb-social-surface="short"'
                ),
            }
            for token, value in replacements.items():
                source = source.replace(token, value)
            return self.html(source)
        lifecycle_script = re.fullmatch(
            r'/demo/lifecycle-(social|engine)-([a-z]+)\.js', route
        )
        if lifecycle_script and lifecycle_script.group(2) in LIFECYCLE_PROFILES:
            kind, profile = lifecycle_script.groups()
            host = LIFECYCLE_PROFILES[profile][0]
            target = 'content/social.js' if kind == 'social' else 'content/engine.js'
            fake_location = (
                f"const location = {{ hostname: '{host}', pathname: '/', "
                f"href: 'https://{host}/' }};"
            )
            source = wrapped_extension_script(fake_location, ROOT / 'extension' / target)
            return self.reply(source, 'text/javascript; charset=utf-8')
        if route == '/demo/tests.html':
            source = (ROOT / 'demo/index.html').read_text()
            scripts = [
                '<script src="harness.js"></script>',
                '<script src="/extension/shared/comfort.js"></script>',
                '<script src="/extension/content/comfort.js"></script>',
                '<script src="/extension/content/social.js"></script>',
                '<script src="/extension/content/engine.js"></script>',
                '<script src="browser-tests.js"></script>',
            ]
            source = source.replace('</body>', ''.join(scripts) + '</body>')
            return self.html(source)
        if route == '/demo/youtube-tests.html':
            return self.html((ROOT / 'demo/youtube.html').read_text())
        if route == '/demo/engine-youtube.js':
            # Fixture-only host adapter. Packaged engine is unchanged; no real YouTube claim.
            fake_location = "const location = { hostname: 'www.youtube.com' };"
            source = wrapped_extension_script(
                fake_location, ROOT / 'extension/content/engine.js'
            )
            return self.reply(source, 'text/javascript; charset=utf-8')
        if route == '/demo/social-tests.html':
            return self.html((ROOT / 'demo/social.html').read_text())
        if route == '/demo/tiktok-tests.html':
            return self.html((ROOT / 'demo/tiktok.html').read_text())
        if route == '/demo/social-instagram.js':
            fake_location = (
                "const location = { hostname: 'www.instagram.com', "
                "get pathname() { return window.fixturePath || '/'; }, "
                "get href() { return 'https://www.instagram.com' + this.pathname; } };"
            )
            source = wrapped_extension_script(
                fake_location, ROOT / 'extension/content/social.js'
            )
            return self.reply(source, 'text/javascript; charset=utf-8')
        if route == '/demo/social-tiktok.js':
            fake_location = (
                "const location = { hostname: 'www.tiktok.com', "
                "get pathname() { return window.fixturePath || '/'; }, "
                "get href() { return 'https://www.tiktok.com' + this.pathname; } };"
            )
            source = wrapped_extension_script(
                fake_location, ROOT / 'extension/content/social.js'
            )
            return self.reply(source, 'text/javascript; charset=utf-8')
        ui_routes = (
            '/demo/popup.html',
            '/demo/options.html',
            '/demo/popup-tests.html',
            '/demo/options-tests.html',
        )
        if route in ui_routes:
            page = 'popup.html' if '/popup' in route else 'options.html'
            source = (ROOT / 'extension/ui' / page).read_text()
            source = source.replace(
                '<head>',
                '<head><base href="/extension/ui/">'
                '<script src="/demo/ui-shim.js"></script>',
            )
            source = source.replace(
                '<main>',
                '<main><p class="notice">'
                'UI test preview — Chrome permissions are simulated here.</p>',
            )
            if '-tests.html' in route:
                source = source.replace(
                    '</body>',
                    '<script type="module" src="/demo/ui-tests.js"></script></body>',
                )
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
    print(
        'Automated DOM fixtures: /demo/tests.html, /demo/youtube-tests.html, '
        '/demo/social-tests.html, /demo/tiktok-tests.html, /demo/comfort.html, '
        'and /demo/lifecycle-<profile>.html',
        flush=True,
    )
    try:
        ThreadingHTTPServer(('127.0.0.1', 8674), FixtureRequestHandler).serve_forever()
    except KeyboardInterrupt:
        print('\nLocal test server stopped.')
