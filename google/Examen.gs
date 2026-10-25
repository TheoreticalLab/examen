// ARCHIVO GENERADO por google/construir.py a partir de Examen.base.gs y js/{azar,banco,examen}.js
// EXAMEN VIRTUAL · servidor del profesor (Google Apps Script, ligado a una hoja de cálculo).
// Lleva la hora oficial (inicio, fin, duración de cada salida), guarda las respuestas, corrige y verifica las claves.
// Instalación: ver google/CONFIGURAR_EXAMEN.md. Tras cambiar EXAMENES o las claves: Implementar → Gestionar
// implementaciones → editar → Versión nueva (la URL /exec no cambia).

// ======================= CONFIGURACIÓN (edita esto) =======================
const EXAMENES = {
  // código que das en clase: { título, minutos, nº de problemas, segundos fuera que bloquean, ¿abierto?, ¿ve la nota al entregar? }
  'P1-FIS': { titulo: 'Primer parcial · Física General', duracionMin: 30, nProblemas: 5, tolerancia: 2, abierto: true, mostrarNota: false }
};
const CLAVE_DOCENTE = 'CAMBIA-ESTA-CLAVE';           // la escribes en el panel del profesor
const SECRETO = 'CAMBIA-ESTE-SECRETO-LARGO';         // genera las claves de desbloqueo: no lo compartas
// ==========================================================================

const HOJA = 'Examenes', GRACIA_S = 90, MAX_INTENTOS = 10;
const COLUMNAS = ['Examen', 'Matrícula', 'Nombre', 'Inicio', 'Fin', 'Estado', 'Respondidas', 'Salidas', 'Segundos fuera', 'Bloqueos', 'Nota', 'Entregado', 'Actualizado', 'Datos (no editar)'];

function doGet() { return json({ ok: true, servicio: 'examen-virtual' }) }
function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents) } catch (x) { return json({ ok: false, error: 'formato' }) }
  const cerrojo = LockService.getScriptLock();
  try { cerrojo.waitLock(20000) } catch (x) { return json({ ok: false, error: 'ocupado' }) }
  try { return json(atender(d, Date.now())) } catch (x) { return json({ ok: false, error: 'servidor: ' + x.message }) } finally { cerrojo.releaseLock() }
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON) }

function hoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(HOJA);
  if (!h) { h = ss.insertSheet(HOJA); h.appendRow(COLUMNAS); h.setFrozenRows(1); h.getRange('B:B').setNumberFormat('@') }
  return h;
}
function filas(h, codigo) {
  const v = h.getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) if (!codigo || String(v[i][0]) === codigo) { try { out.push({ fila: i + 1, est: JSON.parse(v[i][13]) }) } catch (x) { } }
  return out;
}
function buscar(h, codigo, matricula) { return filas(h, codigo).filter(f => f.est.matricula === matricula)[0] || null }
function escribir(h, fila, est, ahora) {
  const R = resumenSalidas(est);
  const estado = est.entregado ? 'Entregado' : est.bloqueo ? 'BLOQUEADO' : 'En curso';
  const fila_ = [est.codigo, est.matricula, est.nombre, new Date(est.inicio), new Date(est.fin), estado, respondidas(est) + ' / ' + est.problemas.length,
    R.salidas, R.segundosFuera, R.bloqueos, est.entregado ? est.entregado.nota : '', est.entregado ? new Date(est.entregado.hora) : '', new Date(ahora), JSON.stringify(est)];
  if (fila) h.getRange(fila, 1, 1, fila_.length).setValues([fila_]); else h.appendRow(fila_);
}
const isoDe = ms => new Date(ms).toISOString();

function limpiarRespuestas(est, r) {
  const out = {};
  if (r && typeof r === 'object') for (const p of est.problemas) if (r[p.id] != null) out[p.id] = String(r[p.id]).slice(0, 40);
  return out;
}
/** Cierra la salida que el servidor tiene abierta (avisada con sendBeacon) usando su propio reloj. */
function cerrarSalida(est, ahora, segCliente, motivo) {
  const abierta = est.servidor.salidaAbierta; delete est.servidor.salidaAbierta;
  const sServ = abierta ? (ahora - abierta) / 1000 : 0, sCli = Math.max(0, Math.min(Number(segCliente) || 0, 86400)), s = Math.max(sServ, sCli);
  return anotarSalida(est, { inicio: isoDe(abierta || ahora - s * 1000), segundos: s, motivo: String(motivo || '').slice(0, 140) + (sServ > sCli + 2 ? ' · duración medida por el servidor' : '') });
}

function atender(d, ahora) {
  const h = hoja();
  if (['panel', 'desbloquear', 'autorizar'].indexOf(d.accion) >= 0) return docente(d, h, ahora);
  const codigo = normalizarCodigo(d.codigo), cfg = EXAMENES[codigo], matricula = normalizarMatricula(d.matricula);
  if (!cfg) return { ok: false, error: 'codigo' };
  if (!matricula) return { ok: false, error: 'matricula' };
  const f = buscar(h, codigo, matricula);

  if (d.accion === 'iniciar') {
    const nombre = normalizarNombre(d.nombre);
    if (!nombre) return { ok: false, error: 'nombre' };
    if (f) {
      const est = f.est; est.servidor = est.servidor || {};
      if (est.nombre.toLowerCase() !== nombre.toLowerCase()) return { ok: false, error: 'matricula-en-uso' };
      // volvió a entrar (otro dispositivo o datos del navegador borrados): si había una salida abierta, se cierra aquí
      if (est.servidor.salidaAbierta && !est.entregado) cerrarSalida(est, ahora, 0, 'volvió a entrar desde el inicio (otro dispositivo o datos borrados)');
      est.reentradas = (est.reentradas || 0) + 1;
      escribir(h, f.fila, est, ahora);
      return inicio(est, cfg, ahora, true);
    }
    if (!cfg.abierto) return { ok: false, error: 'codigo' };
    const est = crearEstado({ nombre, matricula, codigo, nProblemas: cfg.nProblemas, inicio: ahora, fin: ahora + cfg.duracionMin * 60000, tolerancia: cfg.tolerancia });
    est.servidor = {};
    escribir(h, 0, est, ahora);
    return inicio(est, cfg, ahora, false);
  }

  if (!f) return { ok: false, error: 'sin-examen' };
  const est = f.est, iso = isoDe(ahora); est.servidor = est.servidor || {};
  let extra = {};
  switch (d.accion) {
    case 'salida':
      if (!est.servidor.salidaAbierta && !est.entregado) est.servidor.salidaAbierta = ahora;
      break;
    case 'vuelta':
      if (!est.entregado) cerrarSalida(est, ahora, d.segundos, d.motivo);
      break;
    case 'estado':
      break;
    case 'clave':
      if (est.intentosClave >= MAX_INTENTOS) return { ok: false, error: 'intentos', intentosClave: est.intentosClave };
      extra.ok = probarClave(est, d.clave, SECRETO, iso);
      break;
    case 'pedirPermiso':
      est.permiso = Object.assign({}, est.permiso, { pedido: iso, activo: !!(est.permiso && est.permiso.activo) });
      break;
    case 'clavePermiso':
      if (est.intentosClave >= MAX_INTENTOS) return { ok: false, error: 'intentos', intentosClave: est.intentosClave };
      extra.ok = probarClavePermiso(est, d.clave, SECRETO, iso);
      break;
    case 'guardar':
      if (!est.entregado) { est.respuestas = limpiarRespuestas(est, d.respuestas); est.pegados = Math.max(est.pegados || 0, Number(d.pegados) || 0) }
      break;
    case 'entregar':
      if (!est.entregado) {
        est.respuestas = limpiarRespuestas(est, d.respuestas); est.pegados = Math.max(est.pegados || 0, Number(d.pegados) || 0);
        const nota = calificar(est.problemas, est.respuestas);
        est.entregado = { hora: iso, auto: !!d.auto, nota: nota.total, detalle: nota.detalle, tarde: ahora > est.fin + GRACIA_S * 1000, recibo: 'R-' + String(huella(codigo + '|' + matricula + '|' + iso) % 1000000).padStart(6, '0') };
        est.bloqueo = null; delete est.servidor.salidaAbierta;
      }
      escribir(h, f.fila, est, ahora);
      return { ok: true, recibo: est.entregado.recibo, nota: cfg.mostrarNota ? { total: est.entregado.nota, detalle: est.entregado.detalle } : null };
    default:
      return { ok: false, error: 'accion' };
  }
  escribir(h, f.fila, est, ahora);
  return Object.assign({ ok: true, bloqueo: est.bloqueo, permiso: est.permiso, entregado: !!est.entregado, salidas: est.salidas.length, intentosClave: est.intentosClave }, extra);
}

function inicio(est, cfg, ahora, reentrada) {
  return {
    ok: true, inicio: est.inicio, fin: est.fin, ahora, tolerancia: est.tolerancia, nProblemas: est.problemas.length, titulo: cfg.titulo, mostrarNota: !!cfg.mostrarNota,
    estado: reentrada ? { salidas: est.salidas, bloqueo: est.bloqueo, desbloqueos: est.desbloqueos, intentosClave: est.intentosClave, permiso: est.permiso, respuestas: est.respuestas, entregado: est.entregado } : null
  };
}

function docente(d, h, ahora) {
  if (String(d.claveDocente || '') !== CLAVE_DOCENTE || CLAVE_DOCENTE.indexOf('CAMBIA') === 0) return { ok: false, error: 'clave' };
  const codigo = normalizarCodigo(d.codigo), iso = isoDe(ahora);
  if (d.accion === 'panel') {
    return {
      ok: true, ahora, examenes: Object.keys(EXAMENES).map(k => Object.assign({ codigo: k }, EXAMENES[k])),
      estudiantes: filas(h, codigo).map(f => filaPanel(f.est, ahora))
    };
  }
  const f = buscar(h, codigo, normalizarMatricula(d.matricula));
  if (!f) return { ok: false, error: 'sin-examen' };
  f.est.servidor = f.est.servidor || {};
  if (d.accion === 'desbloquear') quitarBloqueo(f.est, 'profesor (panel)', iso);
  if (d.accion === 'autorizar') concederPermiso(f.est, 'profesor (panel)', iso);
  escribir(h, f.fila, f.est, ahora);
  return { ok: true, estudiante: filaPanel(f.est, ahora) };
}

function filaPanel(est, ahora) {
  const s = est.servidor || {};
  return {
    nombre: est.nombre, matricula: est.matricula, codigo: est.codigo, inicio: est.inicio, fin: est.fin, respondidas: respondidas(est), total: est.problemas.length,
    salidas: est.salidas, fueraAhora: s.salidaAbierta && !est.entregado ? Math.round((ahora - s.salidaAbierta) / 1000) : null,
    bloqueo: est.bloqueo, claveDesbloqueo: est.bloqueo ? claveDe(SECRETO, est.codigo, est.matricula, 'D', est.bloqueo.n) : null,
    permiso: est.permiso, clavePermiso: claveDe(SECRETO, est.codigo, est.matricula, 'P', est.salidas.length + 1),
    entregado: est.entregado ? { hora: est.entregado.hora, nota: est.entregado.nota, tarde: est.entregado.tarde, auto: est.entregado.auto, recibo: est.entregado.recibo } : null,
    resumen: resumenSalidas(est), reentradas: est.reentradas || 0, desbloqueos: est.desbloqueos
  };
}

// ======================= CÓDIGO COMPARTIDO CON LA APP (generado: no editar aquí) =======================
// ---- js/azar.js ----
// Azar reproducible: los problemas de cada estudiante salen de «código del examen | matrícula» (semilla).
// sfc32 alimentado con cyrb128: rápido, de buena calidad estadística y sin dependencias. El mismo código corre en el
// navegador y en el Apps Script del profesor (construir.py lo copia), así ambos generan exactamente los mismos problemas.

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Huella numérica de un texto (32 bits). */
function huella(texto) { return cyrb128(String(texto))[0] }

/** Generador con semilla de texto. Misma semilla → misma secuencia, en cualquier navegador y en Apps Script. */
function crearAzar(semilla) {
  const r = sfc32(...cyrb128(String(semilla)));
  for (let i = 0; i < 12; i++) r();
  return {
    siguiente: r,
    entero: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
    // valor en [lo, hi] redondeado al paso (p. ej. 0,05): los enunciados llevan números «de examen»
    paso: (lo, hi, p) => Math.round((lo + (hi - lo) * r()) / p) * p,
    elegir: arr => arr[Math.floor(r() * arr.length)],
    mezclar: arr => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  };
}

// ---- js/banco.js ----
// BANCO DE PROBLEMAS · plantillas con datos aleatorios. Cada estudiante recibe otros números y otro orden, así que
// copiar el resultado del compañero no sirve. Para añadir un problema: una entrada más en PLANTILLAS con
//   id (único y estable: forma parte de la semilla), tema, y generar(az) → { enunciado, tipo: 'num' | 'opcion', ... }
//   · 'num':    unidad, respuesta (número) y, si se quiere, tolerancia relativa (por defecto 2 %)
//   · 'opcion': opciones (textos) y correcta (índice); el orden de las opciones se mezcla por estudiante
// Sin acceso al navegador: este archivo también se copia en el Apps Script del profesor, que corrige las entregas.

const G = 9.8;

/** Número con coma decimal y como mucho `d` decimales, sin ceros sobrantes (12,5 · 0,35 · 4). */
function num(x, d = 2) {
  const f = Math.pow(10, d), r = Math.round(x * f) / f;
  return String(r).replace('.', ',');
}

const PLANTILLAS = [
  {
    id: 'lanzamiento', tema: 'Cinemática',
    generar(az) {
      const h = az.entero(8, 45), v = az.entero(4, 16);
      return {
        tipo: 'num', unidad: 'm', respuesta: v * Math.sqrt(2 * h / G),
        enunciado: `Desde la azotea de un edificio de ${h} m de altura se lanza una pelota horizontalmente con una rapidez de ${v} m/s. ¿A qué distancia horizontal de la base del edificio llega al suelo? Desprecia la resistencia del aire (g = 9,8 m/s²).`
      };
    }
  },
  {
    id: 'plano', tema: 'Dinámica',
    generar(az) {
      const m = az.entero(2, 12), th = az.entero(25, 45), mu = az.paso(0.10, 0.30, 0.05), rad = th * Math.PI / 180;
      return {
        tipo: 'num', unidad: 'm/s²', respuesta: G * (Math.sin(rad) - mu * Math.cos(rad)),
        enunciado: `Un bloque de ${m} kg se suelta sobre un plano inclinado ${th}° respecto a la horizontal. El coeficiente de rozamiento cinético entre el bloque y el plano es μₖ = ${num(mu)}. ¿Cuál es la aceleración del bloque mientras baja? (g = 9,8 m/s²)`
      };
    }
  },
  {
    id: 'resorte', tema: 'Energía',
    generar(az) {
      const k = az.paso(150, 600, 50), x = az.paso(0.05, 0.20, 0.01), m = az.paso(0.5, 3, 0.5);
      return {
        tipo: 'num', unidad: 'm/s', respuesta: x * Math.sqrt(k / m),
        enunciado: `Un resorte de constante k = ${k} N/m está comprimido ${num(x * 100, 0)} cm contra un bloque de ${num(m, 1)} kg, sobre una superficie horizontal sin rozamiento. Se suelta el sistema. ¿Con qué rapidez sale despedido el bloque cuando el resorte recupera su longitud natural?`
      };
    }
  },
  {
    id: 'periodo', tema: 'Oscilaciones',
    generar(az) {
      const m = az.paso(0.2, 2, 0.1), k = az.paso(20, 200, 10);
      return {
        tipo: 'num', unidad: 's', respuesta: 2 * Math.PI * Math.sqrt(m / k),
        enunciado: `Un bloque de ${num(m, 1)} kg unido a un resorte de constante ${k} N/m oscila sobre una mesa horizontal sin rozamiento. ¿Cuál es el período de la oscilación?`
      };
    }
  },
  {
    id: 'choque', tema: 'Momento lineal',
    generar(az) {
      const m1 = az.entero(1, 6), v1 = az.entero(2, 12), m2 = az.entero(1, 6);
      return {
        tipo: 'num', unidad: 'm/s', respuesta: m1 * v1 / (m1 + m2),
        enunciado: `Un carrito de ${m1} kg que se mueve a ${v1} m/s choca contra otro carrito de ${m2} kg que está en reposo. Tras el choque quedan enganchados y se mueven juntos. ¿Con qué rapidez se mueven después del choque?`
      };
    }
  },
  {
    id: 'curva', tema: 'Movimiento circular',
    generar(az) {
      const R = az.paso(30, 150, 5), mu = az.paso(0.30, 0.90, 0.05);
      return {
        tipo: 'num', unidad: 'm/s', respuesta: Math.sqrt(mu * G * R),
        enunciado: `Un coche toma una curva plana (sin peralte) de ${R} m de radio. El coeficiente de rozamiento estático entre las ruedas y el asfalto es μₛ = ${num(mu)}. ¿Cuál es la rapidez máxima con la que puede tomar la curva sin derrapar? (g = 9,8 m/s²)`
      };
    }
  },
  {
    id: 'periodo-masa', tema: 'Oscilaciones',
    generar(az) {
      const T = az.paso(0.8, 2.4, 0.1), f = az.elegir([4, 9]), r = Math.sqrt(f);
      return {
        tipo: 'opcion',
        enunciado: `Un sistema masa-resorte oscila con un período de ${num(T, 1)} s. Si la masa se multiplica por ${f} y se usa el mismo resorte, ¿cuál es el nuevo período?`,
        opciones: [`${num(T * r)} s`, `${num(T * f)} s`, `${num(T / r)} s`, `${num(T, 1)} s (no cambia)`], correcta: 0
      };
    }
  },
  {
    id: 'plano-masa', tema: 'Dinámica',
    generar(az) {
      const th = az.entero(20, 50), m = az.entero(2, 8);
      return {
        tipo: 'opcion',
        enunciado: `Un bloque de ${m} kg baja por un plano inclinado ${th}° sin rozamiento. Si se repite el experimento con un bloque de ${2 * m} kg (el doble de masa), su aceleración:`,
        opciones: ['no cambia', 'se duplica', 'se reduce a la mitad', 'se cuadruplica'], correcta: 0
      };
    }
  }
];

// ---- js/examen.js ----
// LÓGICA DEL EXAMEN · sin navegador: generación de problemas, corrección, salidas, bloqueo y claves.
// construir.py copia este archivo (con azar.js y banco.js) en el Apps Script: navegador y servidor comparten las mismas reglas.


const TOLERANCIA_NUM = 0.02;     // error relativo con el que una respuesta numérica vale entera (2 %)
const MEDIA_NUM = 0.05;          // hasta aquí vale la mitad (redondeos intermedios, g = 10 en vez de 9,8…)

function normalizarMatricula(t) {
  const m = String(t || '').trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(m) ? m : null;
}
function normalizarNombre(t) {
  const n = String(t || '').trim().replace(/\s+/g, ' ');
  return n.length >= 3 && n.length <= 80 && /\p{L}/u.test(n) ? n : null;
}
const normalizarCodigo = t => String(t || '').trim().toUpperCase().replace(/\s+/g, '');

/** Los n problemas de un estudiante: qué plantillas, en qué orden y con qué datos sale de «código | matrícula». */
function generarProblemas(codigo, matricula, n) {
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
function leerNumero(t) {
  const s = String(t == null ? '' : t).trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const x = Number(s);
  return isFinite(x) ? x : null;
}

/** Fracción del problema obtenida (0, ½ o 1). */
function calificarProblema(p, r) {
  if (r == null || r === '') return 0;
  if (p.tipo === 'opcion') return Number(r) === p.correcta ? 1 : 0;
  const x = leerNumero(r); if (x == null) return 0;
  const err = Math.abs(x - p.respuesta) / Math.abs(p.respuesta), tol = p.tolerancia || TOLERANCIA_NUM;
  return err <= tol ? 1 : err <= Math.max(MEDIA_NUM, 2.5 * tol) ? 0.5 : 0;
}

/** Nota sobre 100 (todos los problemas valen lo mismo). */
function calificar(problemas, respuestas) {
  const max = 100 / problemas.length;
  const detalle = problemas.map(p => { const f = calificarProblema(p, respuestas[p.id]); return { id: p.id, fraccion: f, puntos: Math.round(f * max * 10) / 10, max: Math.round(max * 10) / 10 } });
  return { detalle, total: Math.round(detalle.reduce((a, d) => a + d.fraccion * max, 0) * 10) / 10 };
}

/** Clave de 4 cifras para una salida concreta: tipo 'D' (desbloqueo) o 'P' (permiso para salir).
    Solo sirve para ese estudiante, ese examen y esa salida: dictarla a otro no le desbloquea. */
function claveDe(secreto, codigo, matricula, tipo, n) {
  return String(1000 + huella(`${secreto}|${codigo}|${matricula}|${tipo}|${n}`) % 9000);
}

/** Estado nuevo del examen de un estudiante. */
function crearEstado({ nombre, matricula, codigo, nProblemas, inicio, fin, tolerancia }) {
  return {
    version: 1, nombre, matricula, codigo, inicio, fin, tolerancia,
    problemas: generarProblemas(codigo, matricula, nProblemas), respuestas: {}, actual: 0,
    salidas: [], bloqueo: null, desbloqueos: [], intentosClave: 0, permiso: null, pegados: 0, entregado: null
  };
}

/** Registra una salida de la app. Bloquea si duró al menos `tolerancia` s y no tenía permiso. */
function anotarSalida(est, { inicio, segundos, motivo }, tolerancia = est.tolerancia) {
  const n = est.salidas.length + 1, autorizada = !!(est.permiso && est.permiso.activo);
  const bloquea = !autorizada && !est.entregado && segundos >= tolerancia;
  est.salidas.push({ n, inicio, segundos: Math.round(segundos * 10) / 10, motivo: motivo || '', autorizada, bloqueo: bloquea, durante: est.bloqueo ? 'bloqueado' : '' });
  if (autorizada) est.permiso = Object.assign({}, est.permiso, { activo: false, pedido: null, usadoEn: n });
  if (bloquea) est.bloqueo = { n, inicio, segundos: Math.round(segundos * 10) / 10, motivo: motivo || '' };
  return { n, bloquea, autorizada };
}

/** Quita el bloqueo (clave correcta o botón del profesor). */
function quitarBloqueo(est, como, hora) {
  if (!est.bloqueo) return false;
  est.desbloqueos.push({ n: est.bloqueo.n, hora, como });
  est.bloqueo = null;
  return true;
}

/** Comprueba la clave de desbloqueo de la salida que bloqueó el examen. */
function probarClave(est, clave, secreto, hora) {
  if (!est.bloqueo) return true;
  if (String(clave || '').trim() === claveDe(secreto, est.codigo, est.matricula, 'D', est.bloqueo.n)) return quitarBloqueo(est, 'clave', hora);
  est.intentosClave++;
  return false;
}

/** Permiso para la próxima salida (n = salidas + 1): esa salida queda anotada como autorizada y no bloquea. */
function concederPermiso(est, como, hora) { est.permiso = { activo: true, para: est.salidas.length + 1, hora, como }; return true }
function probarClavePermiso(est, clave, secreto, hora) {
  if (String(clave || '').trim() === claveDe(secreto, est.codigo, est.matricula, 'P', est.salidas.length + 1)) return concederPermiso(est, 'clave', hora);
  est.intentosClave++;
  return false;
}

function respondidas(est) { return est.problemas.filter(p => est.respuestas[p.id] != null && est.respuestas[p.id] !== '').length }

/** Resumen de las salidas para el profesor (solo describe: no juzga). */
function resumenSalidas(est) {
  const s = est.salidas;
  return {
    salidas: s.length, autorizadas: s.filter(x => x.autorizada).length, bloqueos: s.filter(x => x.bloqueo).length,
    segundosFuera: Math.round(s.reduce((a, x) => a + x.segundos, 0)), masLarga: s.reduce((a, x) => Math.max(a, x.segundos), 0),
    intentosClave: est.intentosClave, pegados: est.pegados || 0
  };
}

