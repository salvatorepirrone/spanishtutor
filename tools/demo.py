"""Prova in locale dell'interfaccia, senza Netlify e senza Node.

    py tools/demo.py

Serve il sito da http://127.0.0.1:18080 con il backend vero eseguito nel browser (archivio in memoria, salvato nella
sessione del browser) e un Claude SIMULATO: le risposte del tutor, gli esercizi e le liste sono di prova e ripetitive,
ma permettono di percorrere tutte le schermate. Si entra già come utente "demo". Per provare con il vero Claude si usa
`netlify dev` (vedi README).
"""
import http.server, os, sys, threading, webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 18080
INJECT = b"""<script>
window.__ready = import('/netlify/test/shim.mjs');
(function () {
  var real = window.fetch.bind(window);
  window.fetch = function (u, o) {
    var url = new URL(u, location.href);
    if (url.pathname.indexOf('/api') === 0) return window.__ready.then(function (m) { return m.handleFetch(url, o || {}); });
    return real(u, o);
  };
})();
</script>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?')[0].split('#')[0]
        if p.startswith('/netlify/'):
            return os.path.join(ROOT, p.lstrip('/').replace('/', os.sep))
        if p == '/':
            p = '/index.html'
        return os.path.join(ROOT, 'public', p.lstrip('/').replace('/', os.sep))

    def do_GET(self):
        f = self.translate_path(self.path)
        if f.endswith('.html') and os.path.isfile(f):
            body = open(f, 'rb').read().replace(b'<head>', b'<head>' + INJECT, 1)
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    url = 'http://127.0.0.1:%d/' % PORT
    print('Demo in funzione su', url, '(Ctrl+C per fermarla)')
    if '--no-open' not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
