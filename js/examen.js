// LÓGICA DEL EXAMEN · sin navegador: generación de problemas, corrección, salidas, bloqueo y claves.
// construir.py copia este archivo (con azar.js y banco.js) en el Apps Script: navegador y servidor comparten las mismas reglas.
import { crearAzar, huella } from './azar.js';
import { PLANTILLAS } from './banco.js';

export const TOLERANCIA_NUM = 0.02;     // error relativo con el que una respuesta numérica vale entera (2 %)
export const MEDIA_NUM = 0.05;          // hasta aquí vale la mitad (redondeos intermedios, g = 10 en vez de 9,8…)

export function normalizarMatricula(t) {
  const m = String(t || '').trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(m) ? m : null;
}
export function normalizarNombre(t) {
  const n = String(t || '').trim().replace(/\s+/g, ' ');
  return n.length >= 3 && n.length <= 80 && /\p{L}/u.test(n) ? n : null;
}
export const normalizarCodigo = t => String(t || '').trim().toUpperCase().replace(/\s+/g, '');

/** Los n problemas de un estudiante: qué plantillas, en qué orden y con qué datos sale de «código | matrícula». */
export function generarProblemas(codigo, matricula, n) {
  const base = `${codigo}|${matricula}`;
  return crearAzar(base).mezclar(PLANTILLAS).slice(0, n).map(t => {
    const p = t.generar(crearAzar(`${base}|${t.id}`)), q = { id: t.id, tema: t.tema, tipo: p.tipo, enunciado: p.enunciado };
    if (p.tipo === 'num') { q.unidad = p.unidad; q.respuesta = p.respuesta; q.tolerancia = p.tolerancia || TOLERANCIA_NUM }
    else {
      const orden = crearAzar(`${base}|${t.id}|orden`).mezclar(p.opciones.map((_, i) => i));
      q.opciones = orden.map(i => p.opciones[i]); q.correcta = orden.indexOf(p.correcta);
    }
    return q;
  });
}

/** «12,5», «12.5», «-3», «1,2e3» → número; cualquier otra cosa → null. */
export function leerNumero(t) {
  const s = String(t == null ? '' : t).trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const x = Number(s);
  return isFinite(x) ? x : null;
}

/** Fracción del problema obtenida (0, ½ o 1). */
export function calificarProblema(p, r) {
  if (r == null || r === '') return 0;
  if (p.tipo === 'opcion') return Number(r) === p.correcta ? 1 : 0;
  const x = leerNumero(r); if (x == null) return 0;
  const err = Math.abs(x - p.respuesta) / Math.abs(p.respuesta), tol = p.tolerancia || TOLERANCIA_NUM;
  return err <= tol ? 1 : err <= Math.max(MEDIA_NUM, 2.5 * tol) ? 0.5 : 0;
}

/** Nota sobre 100 (todos los problemas valen lo mismo). */
export function calificar(problemas, respuestas) {
  const max = 100 / problemas.length;
  const detalle = problemas.map(p => { const f = calificarProblema(p, respuestas[p.id]); return { id: p.id, fraccion: f, puntos: Math.round(f * max * 10) / 10, max: Math.round(max * 10) / 10 } });
  return { detalle, total: Math.round(detalle.reduce((a, d) => a + d.fraccion * max, 0) * 10) / 10 };
}

/** Clave de 4 cifras para una salida concreta: tipo 'D' (desbloqueo) o 'P' (permiso para salir).
    Solo sirve para ese estudiante, ese examen y esa salida: dictarla a otro no le desbloquea. */
export function claveDe(secreto, codigo, matricula, tipo, n) {
  return String(1000 + huella(`${secreto}|${codigo}|${matricula}|${tipo}|${n}`) % 9000);
}

/** Estado nuevo del examen de un estudiante. */
export function crearEstado({ nombre, matricula, codigo, nProblemas, inicio, fin, tolerancia }) {
  return {
    version: 1, nombre, matricula, codigo, inicio, fin, tolerancia,
    problemas: generarProblemas(codigo, matricula, nProblemas), respuestas: {}, actual: 0,
    salidas: [], bloqueo: null, desbloqueos: [], intentosClave: 0, permiso: null, pegados: 0, entregado: null
  };
}

/** Registra una salida de la app. Bloquea si duró al menos `tolerancia` s y no tenía permiso. */
export function anotarSalida(est, { inicio, segundos, motivo }, tolerancia = est.tolerancia) {
  const n = est.salidas.length + 1, autorizada = !!(est.permiso && est.permiso.activo);
  const bloquea = !autorizada && !est.entregado && segundos >= tolerancia;
  est.salidas.push({ n, inicio, segundos: Math.round(segundos * 10) / 10, motivo: motivo || '', autorizada, bloqueo: bloquea, durante: est.bloqueo ? 'bloqueado' : '' });
  if (autorizada) est.permiso = Object.assign({}, est.permiso, { activo: false, pedido: null, usadoEn: n });
  if (bloquea) est.bloqueo = { n, inicio, segundos: Math.round(segundos * 10) / 10, motivo: motivo || '' };
  return { n, bloquea, autorizada };
}

/** Quita el bloqueo (clave correcta o botón del profesor). */
export function quitarBloqueo(est, como, hora) {
  if (!est.bloqueo) return false;
  est.desbloqueos.push({ n: est.bloqueo.n, hora, como });
  est.bloqueo = null;
  return true;
}

/** Comprueba la clave de desbloqueo de la salida que bloqueó el examen. */
export function probarClave(est, clave, secreto, hora) {
  if (!est.bloqueo) return true;
  if (String(clave || '').trim() === claveDe(secreto, est.codigo, est.matricula, 'D', est.bloqueo.n)) return quitarBloqueo(est, 'clave', hora);
  est.intentosClave++;
  return false;
}

/** Permiso para la próxima salida (n = salidas + 1): esa salida queda anotada como autorizada y no bloquea. */
export function concederPermiso(est, como, hora) { est.permiso = { activo: true, para: est.salidas.length + 1, hora, como }; return true }
export function probarClavePermiso(est, clave, secreto, hora) {
  if (String(clave || '').trim() === claveDe(secreto, est.codigo, est.matricula, 'P', est.salidas.length + 1)) return concederPermiso(est, 'clave', hora);
  est.intentosClave++;
  return false;
}

export function respondidas(est) { return est.problemas.filter(p => est.respuestas[p.id] != null && est.respuestas[p.id] !== '').length }

/** Resumen de las salidas para el profesor (solo describe: no juzga). */
export function resumenSalidas(est) {
  const s = est.salidas;
  return {
    salidas: s.length, autorizadas: s.filter(x => x.autorizada).length, bloqueos: s.filter(x => x.bloqueo).length,
    segundosFuera: Math.round(s.reduce((a, x) => a + x.segundos, 0)), masLarga: s.reduce((a, x) => Math.max(a, x.segundos), 0),
    intentosClave: est.intentosClave, pegados: est.pegados || 0
  };
}
