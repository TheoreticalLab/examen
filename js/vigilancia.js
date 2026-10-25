// VIGILANCIA DEL EXAMEN · lo que el navegador permite (anunciado al estudiante antes de empezar):
//   · salidas de la app: cambio de app o pestaña (visibilitychange) y pérdida de foco (blur). Si el sistema cierra la página
//     estando fuera, la salida se recupera al reabrirla (queda guardada desde que empezó).
//   · aviso en el móvil al salir (notificación con vibración) para que nadie «salga sin darse cuenta».
//   · pantalla completa y pantalla siempre encendida mientras dura el examen.
//   · botón «atrás»: no sale; pide confirmación.
//   · pegar, arrastrar y copiar: bloqueados.
// No ve otras apps ni otro dispositivo: eso no lo permite ningún navegador.

const CLAVE_SALIDA = 'examen-virtual-salida';
let activo = false, salida = null, cb = {}, reg = null, candado = null;
const previo = new WeakMap();
/** El propio examen cambió el valor de un campo (calculadora): no es una inserción del estudiante. */
export function fijarValor(el) { if (el) previo.set(el, el.value) }

const guarda = s => { try { if (s) localStorage.setItem(CLAVE_SALIDA, JSON.stringify(s)); else localStorage.removeItem(CLAVE_SALIDA) } catch (e) { } };

/** { alSalir(s), alVolver(s, finMs), alAtras(), alPegar(como), alPantalla(completa) } */
export function configurar(c) { cb = c }
export function activar(on) { activo = on; if (!on) { salida = null; guarda(null) } }

function empieza(motivo) {
  if (!activo || salida) return;
  salida = { inicio: Date.now(), motivo }; guarda(salida);
  avisarFuera();
  if (cb.alSalir) cb.alSalir(salida);
}
function termina() {
  if (!salida) return;
  const s = salida; salida = null; guarda(null); cerrarAvisos();
  if (cb.alVolver) cb.alVolver(s, Date.now());
}

/** Salida que quedó abierta porque la página se cerró estando fuera (se llama al cargar). */
export function salidaPendiente() {
  let s = null; try { s = JSON.parse(localStorage.getItem(CLAVE_SALIDA) || 'null') } catch (e) { }
  guarda(null);
  return s && s.inicio ? s : null;
}

export function instalar(doc = document, win = window) {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') empieza('salió de la app (otra app o pestaña)');
    else { termina(); if (activo) mantenerEncendida() }
  });
  win.addEventListener('blur', () => empieza('la ventana perdió el foco'));
  win.addEventListener('focus', () => termina());
  win.addEventListener('pageshow', () => { if (doc.visibilityState === 'visible') termina() });
  // «atrás» no sale del examen
  win.addEventListener('popstate', () => { if (!activo) return; try { history.pushState({ examen: 1 }, '', location.href) } catch (e) { } if (cb.alAtras) cb.alAtras() });
  doc.addEventListener('fullscreenchange', () => { if (cb.alPantalla) cb.alPantalla(!!doc.fullscreenElement) });
  // pegar / arrastrar / copiar
  const campo = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');
  const bloquea = (e, como) => { if (!activo) return; e.preventDefault(); if (cb.alPegar) cb.alPegar(como) };
  doc.addEventListener('paste', e => bloquea(e, 'pegar'), true);
  doc.addEventListener('drop', e => bloquea(e, 'arrastrar'), true);
  doc.addEventListener('copy', e => bloquea(e, 'copiar'), true);
  doc.addEventListener('cut', e => bloquea(e, 'copiar'), true);
  doc.addEventListener('contextmenu', e => { if (activo && !campo(e.target)) e.preventDefault() });
  doc.addEventListener('beforeinput', e => { if (activo && campo(e.target) && /^insertFrom(Paste|Drop|PasteAsQuotation)$/.test(e.inputType)) bloquea(e, 'pegar') }, true);
  // bloques insertados de golpe (portapapeles del teclado del móvil): se deshacen
  doc.addEventListener('focusin', e => { if (campo(e.target)) previo.set(e.target, e.target.value) }, true);
  doc.addEventListener('input', e => {
    const el = e.target; if (!activo || !campo(el)) return;
    const antes = previo.has(el) ? previo.get(el) : '';
    if (el.value.length - antes.length >= 6) { el.value = antes; e.stopImmediatePropagation(); if (cb.alPegar) cb.alPegar('insertar'); return }
    previo.set(el, el.value);
  }, true);
}

/** Al empezar el examen (dentro del clic del estudiante: el navegador lo exige). */
export function trampaAtras() { try { history.pushState({ examen: 1 }, '', location.href) } catch (e) { } }
export const admitePantallaCompleta = () => !!(document.documentElement.requestFullscreen && document.fullscreenEnabled);
export function pantallaCompleta() {
  if (!admitePantallaCompleta() || document.fullscreenElement) return;
  try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }) } catch (e) { }
}
export function salirPantallaCompleta() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }) } catch (e) { } }
export async function mantenerEncendida() {
  try { if ('wakeLock' in navigator && (!candado || candado.released)) candado = await navigator.wakeLock.request('screen') } catch (e) { }
}
export async function prepararAvisos() {
  try {
    if ('serviceWorker' in navigator) reg = await navigator.serviceWorker.register('sw.js');
    // se pide antes de empezar (al aceptar las reglas): durante el examen no hay ventanas de silencio que aprovechar
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  } catch (e) { }
}
export const avisosActivos = () => !!(reg && 'Notification' in window && Notification.permission === 'granted');
function avisarFuera() {
  if (!avisosActivos()) return;
  try {
    reg.showNotification('⚠️ Has salido del examen', {
      body: 'Vuelve ya. Tu profesor verá cuánto tiempo estuviste fuera.', tag: 'examen', renotify: true,
      requireInteraction: true, vibrate: [300, 120, 300, 120, 300], icon: 'icono.svg'
    }).catch(() => { });
  } catch (e) { }
}
function cerrarAvisos() { try { if (reg) reg.getNotifications({ tag: 'examen' }).then(ns => ns.forEach(n => n.close())).catch(() => { }) } catch (e) { } }
