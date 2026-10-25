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
/*__COMPARTIDO__*/
