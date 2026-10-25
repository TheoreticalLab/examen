"""Capturas en móvil (390 px): entrada, examen, bloqueo, entregado, generador del profesor y panel en vivo.
    python3 pruebas/capturas.py      → pruebas/capturas/*.png"""
import os, subprocess, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import correr
from http.server import ThreadingHTTPServer

SAL = os.path.join(correr.RAIZ, 'pruebas', 'capturas')
os.makedirs(SAL, exist_ok=True)
srv = ThreadingHTTPServer(('127.0.0.1', 8792), correr.H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
perfil = os.path.join(correr.RAIZ, 'pruebas', '.perfil_capturas')
base = ['google-chrome', '--headless=new', f'--user-data-dir={perfil}', '--no-first-run', '--hide-scrollbars', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1']
vistas = {'entrada': ('vista.html?v=entrada', 1500), 'examen': ('vista.html?v=examen', 1500), 'bloqueo': ('vista.html?v=bloqueo', 900),
          'entregado': ('vista.html?v=entregado', 1100), 'docente_demo': ('vista.html?v=docente', 1200), 'panel': ('vista_panel.html', 1500)}
for nombre, (ruta, alto) in vistas.items():
    out = os.path.join(SAL, nombre + '.png')
    subprocess.run(base + [f'--window-size=390,{alto}', '--virtual-time-budget=4000', f'--screenshot={out}', f'http://127.0.0.1:8792/pruebas/{ruta}'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    print('ok' if os.path.exists(out) else 'falta', out)
srv.shutdown()
