# Activar el modo real (tu servidor en Google)

Sin esto, el examen funciona en **modo demostración**: todo ocurre en el móvil y las claves salen del generador de
`docente.html`. Sirve para probarlo, no para un examen de verdad, porque un estudiante con conocimientos podría calcular las claves.

En modo real, tu Apps Script lleva:

- la **hora oficial**: inicio, fin y duración de cada salida (cambiar el reloj del móvil no sirve);
- las **claves**, que nunca están en el móvil;
- la **corrección**;
- tu **panel en vivo**.

## Pasos (unos 10 minutos)

1. En Google Drive, crea una hoja de cálculo nueva, por ejemplo «Examen virtual · respuestas».
2. Abre **Extensiones → Apps Script**. Borra lo que haya y pega **todo** el contenido de `google/Examen.gs`.
3. Arriba del todo, edita la configuración:
   - `EXAMENES`: un código por examen, con:
     - título;
     - minutos;
     - número de problemas;
     - segundos fuera que bloquean;
     - `abierto` (si se puede empezar);
     - `mostrarNota` (si el estudiante ve la nota al entregar).
   - `CLAVE_DOCENTE`: la clave para entrar en tu panel.
   - `SECRETO`: una frase larga cualquiera. Genera las claves de desbloqueo; no la compartas.
4. Pulsa **Implementar → Nueva implementación** y elige el tipo **Aplicación web**:
   - *Ejecutar como:* **Yo**;
   - *Quién tiene acceso:* **Cualquier usuario**.

   Autoriza el acceso cuando te lo pida.
5. Copia la URL que termina en `/exec`. Esa URL va en `js/config.js` → `urlServidor`, o me la pasas y lo publico yo.

## Durante el examen

- Abre `docente.html` en tu móvil o en el ordenador. Escribe el código del examen y tu `CLAVE_DOCENTE`.
- La lista se actualiza cada 5 s y muestra a cada estudiante:
  - 🔒 **bloqueado**, con cuánto tiempo estuvo fuera, la clave para dictarle y el botón **Desbloquear**;
  - **fuera ahora**, con los segundos que lleva fuera en este momento;
  - **pide permiso para salir**, con la clave de permiso y el botón **Autorizar salida**;
  - **en curso** o **entregado** (con su nota).
- La hoja «Examenes» tiene una fila por estudiante, con estado, salidas, segundos fuera, nota y hora de entrega.

## Cambiar el examen

- Para cambiar `EXAMENES` o las claves: **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: nueva**. La URL no cambia.
- Para cerrar un examen, pon `abierto: false`. Quien ya empezó puede terminar; nadie nuevo puede entrar.
- Si cambias el banco de problemas (`js/banco.js`), ejecuta `python3 google/construir.py` y vuelve a pegar `Examen.gs`. Así el servidor corrige con los mismos problemas que ve el estudiante.

## Capacidad

Cada estudiante hace pocas llamadas: al empezar, en cada salida, un guardado cada 30 s y la entrega. Un grupo de 40–60 estudiantes a la vez está dentro de los límites gratuitos de Apps Script.
