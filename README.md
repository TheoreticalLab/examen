# Examen virtual · Física General

Examen en el navegador del móvil con temporizador, problemas aleatorios por estudiante y bloqueo al salir de la app.
Es una página estática (GitHub Pages) y no usa dependencias.

## Para el estudiante

1. Escribe su nombre, su matrícula y el código del examen, y acepta las reglas.
2. Recibe 5 problemas elegidos de un banco de 8 plantillas, con **números distintos** y **en otro orden** que sus compañeros:
   - cinemática, dinámica, energía, oscilaciones, momento lineal y movimiento circular;
   - respuestas numéricas con unidad o de opción múltiple.
3. Tiene un **temporizador**. Al llegar a cero, el examen se entrega solo.
4. Tiene una **calculadora científica dentro del examen**, para no tener que salir a la del móvil.
5. Si **sale de la app 2 s o más**, el examen **se bloquea**:
   - la pantalla muestra cuánto tiempo estuvo fuera;
   - solo continúa con la **clave del profesor**, que vale solo para ese estudiante y esa salida;
   - en modo real, el profesor también puede pulsar *Desbloquear* en su panel.

   Las salidas más cortas se registran y se avisa al estudiante.
6. **El reloj sigue corriendo** mientras el examen está bloqueado.
7. Puede **pedir permiso para salir**. Esa salida queda anotada como *autorizada* y no bloquea.
8. Otras protecciones:
   - recargar, cerrar la página o entrar desde otro móvil no quita el bloqueo;
   - el botón «atrás» no sale;
   - copiar y pegar están desactivados;
   - el examen pide pantalla completa y mantiene la pantalla encendida;
   - al salir, el móvil muestra el aviso «⚠️ Has salido del examen» con vibración, si el estudiante aceptó las notificaciones.
9. Al entregar, ve su recibo y, si el examen lo permite, su nota con el detalle por problema.

**Lo que no puede hacer ninguna web:** ver qué hace el estudiante fuera de la app o detectar un segundo dispositivo. Para eso está la vigilancia en el aula.

## Para el profesor

- **Modo demostración** (sin servidor):
  - código `DEMO`;
  - las claves salen de `docente.html` (generador).
- **Modo real** (tu Apps Script):
  - panel en vivo en `docente.html`;
  - hoja de cálculo con una fila por estudiante.
  - Ver [google/CONFIGURAR_EXAMEN.md](google/CONFIGURAR_EXAMEN.md).
- Para añadir problemas, añade una entrada en `PLANTILLAS` (`js/banco.js`). Luego ejecuta `python3 google/construir.py`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/banco.js` | plantillas de problemas (compartido con el servidor) |
| `js/examen.js` | reglas: generación, corrección, salidas, bloqueo, claves (compartido con el servidor) |
| `js/vigilancia.js` | salidas de la app, aviso en el móvil, pantalla completa, «atrás», copiar/pegar |
| `js/calculadora.js` | calculadora científica sin `eval` |
| `js/app.js` | interfaz del estudiante |
| `js/docente.js` | panel del profesor y generador de claves |
| `google/Examen.base.gs` → `google/Examen.gs` | servidor en Apps Script (`construir.py` le añade el código compartido) |

## Pruebas

Las pruebas usan Chrome sin pantalla y solo la biblioteca estándar de Python:

```
python3 pruebas/correr.py                                 # lógica, banco de problemas, calculadora y servidor (30)
python3 pruebas/correr.py pruebas/pantalla.html 400,860   # interfaz completa en modo demostración (38)
python3 pruebas/correr.py pruebas/real.html 400,860       # app en modo real contra el servidor simulado (17)
python3 pruebas/correr.py pruebas/panel.html 1100,900     # panel del profesor en modo real (13)
python3 pruebas/capturas.py                               # capturas en móvil
```
