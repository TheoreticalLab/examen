"""Ejecuta las pruebas automatizadas en Chrome sin pantalla (biblioteca estándar de Python; sin npm ni dependencias).

    python3 pruebas/correr.py                 # todas las pruebas (física, mediciones, pedagogía, 100+ sesiones con bots)
    python3 pruebas/correr.py pruebas/pantalla.html   # otra página de pruebas

Sirve la carpeta del proyecto en 127.0.0.1 (los módulos ES no funcionan desde file://), abre la página de pruebas y espera
a que publique su resultado en /resultado. Código de salida 0 si todo pasa."""
import json, os, subprocess, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
resultado = {}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        d = json.loads(self.rfile.read(n).decode('utf-8'))
        if d.get('fin'):
            resultado.update(d)
        else:
            print(d.get('txt', ''), flush=True)
        self.send_response(200)
        self.end_headers()


def main():
    pagina = sys.argv[1] if len(sys.argv) > 1 else 'pruebas/pruebas.html'
    ancho = sys.argv[2] if len(sys.argv) > 2 else '1280,900'
    srv = ThreadingHTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    puerto = srv.server_address[1]
    perfil = os.path.join(RAIZ, 'pruebas', '.perfil_chrome')
    p = subprocess.Popen(['google-chrome', '--headless=new', f'--user-data-dir={perfil}', '--no-first-run', f'--window-size={ancho}',
                          '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1', f'http://127.0.0.1:{puerto}/{pagina}'],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    try:
        while not resultado and time.time() - t0 < 900 and p.poll() is None:
            time.sleep(0.3)
    finally:
        p.kill()
        srv.shutdown()
    if not resultado:
        print('SIN RESULTADO (tiempo agotado o Chrome cerrado)')
        sys.exit(2)
    for l in resultado.get('lineas', []):
        print(l)
    print(f"\n{resultado.get('pasan', 0)} de {resultado.get('total', 0)} pruebas pasan · {round(time.time() - t0, 1)} s")
    sys.exit(0 if resultado.get('pasan') == resultado.get('total') else 1)


if __name__ == '__main__':
    main()
