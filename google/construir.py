"""Genera google/Examen.gs: el servidor (Examen.base.gs) + el código compartido con la app (azar, banco de problemas, reglas).

    python3 google/construir.py

Así la app y el servidor generan los mismos problemas y aplican las mismas reglas. Vuelve a ejecutarlo después de
cambiar el banco de problemas y pega el Examen.gs nuevo en el editor de Apps Script."""
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPARTIDOS = ['js/azar.js', 'js/banco.js', 'js/examen.js']


def sin_modulos(texto):
    texto = re.sub(r'^import .*?;\s*$', '', texto, flags=re.M)
    return re.sub(r'^export ', '', texto, flags=re.M)


def main():
    base = open(os.path.join(RAIZ, 'google', 'Examen.base.gs'), encoding='utf-8').read()
    partes = []
    for ruta in COMPARTIDOS:
        partes.append(f'// ---- {ruta} ----\n' + sin_modulos(open(os.path.join(RAIZ, ruta), encoding='utf-8').read()).strip() + '\n')
    salida = base.replace('/*__COMPARTIDO__*/', '\n'.join(partes))
    with open(os.path.join(RAIZ, 'google', 'Examen.gs'), 'w', encoding='utf-8') as f:
        f.write('// ARCHIVO GENERADO por google/construir.py a partir de Examen.base.gs y js/{azar,banco,examen}.js\n' + salida)
    print('google/Examen.gs generado ·', len(salida.splitlines()), 'líneas')


if __name__ == '__main__':
    main()
