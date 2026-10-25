// PANEL DEL PROFESOR · modo real: lista en vivo (cada 5 s) con quién está bloqueado, quién está fuera ahora mismo,
// cuánto duró cada salida y las claves; botones Desbloquear y Autorizar salida. Modo demostración: generador de claves.
import { CONFIG } from './config.js';
import { claveDe, normalizarMatricula, normalizarCodigo } from './examen.js';
import { crearCliente } from './servidor.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const seg = s => String(Math.round(s * 10) / 10).replace('.', ',');
const hora = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` };
const toast = t => { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true }, 4000) };
const srv = crearCliente({ url: CONFIG.urlServidor });
let sesion = null, datos = null, bloqueadosAntes = new Set(), temporizador = null;

/* ---------------- modo demostración: generador de claves ---------------- */
function pintarDemo() {
  $('panel').innerHTML = `<div class="tarjeta"><h1>Generador de claves</h1>
    <div class="aviso am">Modo demostración: la app no está conectada a tu Apps Script. Las claves se calculan aquí con el secreto de demostración.
    En modo real, este panel muestra a tus estudiantes en vivo y las claves salen de tu servidor.</div>
    <label>Código del examen<input id="gCodigo" value="${esc(CONFIG.demo.codigo)}" autocomplete="off"></label>
    <label>Matrícula del estudiante<input id="gMatricula" autocomplete="off" autocapitalize="characters" placeholder="la que aparece en su pantalla"></label>
    <label>N.º de salida<input id="gN" inputmode="numeric" value="1" autocomplete="off"></label>
    <fieldset class="opciones"><legend class="resp-lbl">Tipo de clave</legend>
      <label class="opcion"><input type="radio" name="gTipo" value="D" checked> <span><b>Desbloqueo</b>: el examen está bloqueado (su pantalla dice «salida n.º …»)</span></label>
      <label class="opcion"><input type="radio" name="gTipo" value="P"> <span><b>Permiso para salir</b>: pidió permiso (su pantalla dice «permiso para salida n.º …»)</span></label></fieldset>
    <div id="gRes" aria-live="polite"></div></div>
    <div class="tarjeta"><h2>Cómo probarlo</h2><ol>
    <li>En el móvil abre el examen, escribe un nombre, una matrícula y el código <b>${esc(CONFIG.demo.codigo)}</b>.</li>
    <li>Sal de la app unos segundos (cambia a otra app) y vuelve: el examen queda bloqueado y muestra <b>cuánto tiempo</b> estuviste fuera.</li>
    <li>Escribe aquí la matrícula y el n.º de salida que muestra su pantalla: la clave de 4 cifras lo desbloquea. Solo sirve para ese estudiante y esa salida.</li></ol></div>`;
  const gen = () => {
    const m = normalizarMatricula($('gMatricula').value), n = parseInt($('gN').value, 10), c = normalizarCodigo($('gCodigo').value), t = document.querySelector('[name="gTipo"]:checked').value;
    $('gRes').innerHTML = !m ? '<p class="suave">Escribe la matrícula.</p>' : !(n >= 1) ? '<p class="suave">Escribe el n.º de salida.</p>'
      : `<p class="suave peq" style="margin-bottom:0">${t === 'D' ? 'Clave de desbloqueo' : 'Clave de permiso'} · ${esc(m)} · salida n.º ${n}</p><p class="clave-grande" id="gClave">${claveDe(CONFIG.demo.secreto, c, m, t, n)}</p>`;
  };
  $('panel').addEventListener('input', gen); $('panel').addEventListener('change', gen); gen();
}

/* ---------------- modo real: panel en vivo ---------------- */
function pintarAcceso(msg = '') {
  $('panel').innerHTML = `<div class="tarjeta"><h1>Panel del profesor</h1>${msg ? `<div class="aviso mal" role="alert">${esc(msg)}</div>` : ''}
    <label>Código del examen<input id="aCodigo" autocomplete="off" autocapitalize="characters" value="${esc(sesionGuardada().codigo || '')}"></label>
    <label>Clave del profesor (la de tu Apps Script)<input id="aClave" type="password" autocomplete="current-password"></label>
    <p><button type="button" class="btn prim ancho" id="bAcceso">Ver a mis estudiantes</button></p></div>`;
}
function sesionGuardada() { try { return JSON.parse(sessionStorage.getItem('examen-panel') || '{}') } catch (e) { return {} } }

async function actualizar() {
  if (!sesion) return;
  const r = await srv.llamar('panel', sesion);
  if (!r.ok) {
    if (r.error === 'clave') { sesion = null; clearInterval(temporizador); return pintarAcceso('Clave del profesor incorrecta.') }
    $('cabEstado').hidden = false; $('cabEstado').textContent = '⚠️ sin conexión · reintentando'; return;
  }
  datos = r; pintarLista();
  const ahoraBloq = new Set(r.estudiantes.filter(e => e.bloqueo).map(e => e.matricula));
  if ([...ahoraBloq].some(m => !bloqueadosAntes.has(m)) && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  bloqueadosAntes = ahoraBloq;
}

const prioridad = e => e.bloqueo ? 0 : e.fueraAhora != null ? 1 : e.permiso && e.permiso.pedido && !e.permiso.activo ? 2 : e.entregado ? 4 : 3;
function pintarLista() {
  const r = datos, lista = r.estudiantes.slice().sort((a, b) => prioridad(a) - prioridad(b) || a.nombre.localeCompare(b.nombre));
  const n = k => lista.filter(e => prioridad(e) === k).length;
  document.title = (n(0) ? `🔒 ${n(0)} · ` : '') + 'Panel del profesor';
  $('cabEstado').hidden = false; $('cabEstado').textContent = `${sesion.codigo} · actualizado ${hora(r.ahora)}`;
  $('panel').innerHTML = `<div class="tarjeta"><div class="fila" style="margin-top:0;align-items:center"><h1 style="margin:0">${esc(sesion.codigo)}</h1>
      <span class="suave peq">${lista.length} estudiantes · <b class="malt">${n(0)} bloqueados</b> · ${n(1)} fuera ahora · ${n(2)} piden permiso · ${n(3)} en curso · ${n(4)} entregados</span>
      <button type="button" class="btn chico" id="bCsv">Descargar CSV</button></div></div>
    ${lista.map(e => tarjeta(e, r.ahora)).join('') || '<div class="tarjeta suave">Aún no ha entrado nadie con este código.</div>'}`;
}
function tarjeta(e, ahora) {
  const pidePermiso = e.permiso && e.permiso.pedido && !e.permiso.activo;
  const estado = e.bloqueo ? '<span class="estado bloq">🔒 BLOQUEADO</span>' : e.fueraAhora != null ? `<span class="estado bloq">FUERA AHORA · ${e.fueraAhora} s</span>`
    : pidePermiso ? '<span class="estado perm">Pide permiso para salir</span>' : e.entregado ? `<span class="estado fin">Entregado ${hora(e.entregado.hora)}${e.entregado.tarde ? ' · tarde' : ''}</span>` : '<span class="estado curso">En curso</span>';
  const sal = e.salidas.map(s => `<span class="sal ${s.bloqueo ? 'b' : s.autorizada ? 'a' : ''}" title="salida n.º ${s.n} a las ${hora(s.inicio)}${s.motivo ? ' · ' + esc(s.motivo) : ''}">${seg(s.segundos)} s${s.bloqueo ? ' 🔒' : s.autorizada ? ' ✓' : ''}</span>`).join('') || '<span class="suave peq">ninguna</span>';
  const acc = [];
  if (e.bloqueo) acc.push(`<div><span class="suave peq">Salida n.º ${e.bloqueo.n} · ${seg(e.bloqueo.segundos)} s fuera · a las ${hora(e.bloqueo.inicio)}</span><div class="fila" style="margin-top:4px;align-items:center"><span class="clave-grande" style="font-size:28px;margin:0">${esc(e.claveDesbloqueo)}</span><button type="button" class="btn prim" data-desbloquear="${esc(e.matricula)}">Desbloquear</button></div></div>`);
  if (pidePermiso) acc.push(`<div><span class="suave peq">Pide permiso para la salida n.º ${e.salidas.length + 1}</span><div class="fila" style="margin-top:4px;align-items:center"><span class="clave-grande" style="font-size:28px;margin:0">${esc(e.clavePermiso)}</span><button type="button" class="btn" data-autorizar="${esc(e.matricula)}">Autorizar salida</button></div></div>`);
  return `<div class="tarjeta ${e.bloqueo ? 'bloq' : ''}" style="${e.bloqueo ? 'border-color:var(--mal)' : ''}">
    <div class="fila" style="margin-top:0;align-items:center"><div><b>${esc(e.nombre)}</b> <span class="mono suave">${esc(e.matricula)}</span></div>${estado}</div>
    <p class="peq" style="margin:6px 0">${e.entregado ? `Nota: <b>${String(e.entregado.nota).replace('.', ',')}</b> / 100${e.entregado.auto ? ' (entregado al acabar el tiempo)' : ''}` : `Quedan <b>${mmss((e.fin - ahora) / 1000)}</b>`} · ${e.respondidas} / ${e.total} respondidos
      · salidas: ${e.resumen.salidas} (${e.resumen.segundosFuera} s fuera)${e.resumen.intentosClave ? ` · claves incorrectas: ${e.resumen.intentosClave}` : ''}${e.resumen.pegados ? ` · intentos de pegar/copiar: ${e.resumen.pegados}` : ''}${e.reentradas ? ` · volvió a entrar desde el inicio: ${e.reentradas}` : ''}</p>
    <div>${sal}</div>${acc.join('')}</div>`;
}
function csv() {
  const fil = [['Examen', 'Matrícula', 'Nombre', 'Estado', 'Nota', 'Respondidas', 'Salidas', 'Autorizadas', 'Bloqueos', 'Segundos fuera', 'Salida más larga (s)', 'Claves incorrectas', 'Pegar/copiar', 'Detalle de salidas']];
  for (const e of datos.estudiantes) fil.push([e.codigo, e.matricula, e.nombre, e.entregado ? 'entregado' : e.bloqueo ? 'bloqueado' : 'en curso', e.entregado ? e.entregado.nota : '', e.respondidas, e.resumen.salidas, e.resumen.autorizadas, e.resumen.bloqueos, e.resumen.segundosFuera, e.resumen.masLarga, e.resumen.intentosClave, e.resumen.pegados, e.salidas.map(s => `${hora(s.inicio)} ${seg(s.segundos)}s${s.bloqueo ? ' bloqueo' : ''}${s.autorizada ? ' autorizada' : ''}`).join(' | ')]);
  const t = '﻿' + fil.map(f => f.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = `examen-${sesion.codigo}.csv`; a.click();
}

document.addEventListener('click', async ev => {
  const t = ev.target.closest('button'); if (!t) return;
  if (t.id === 'bAcceso') {
    sesion = { codigo: normalizarCodigo($('aCodigo').value), claveDocente: $('aClave').value };
    try { sessionStorage.setItem('examen-panel', JSON.stringify({ codigo: sesion.codigo })) } catch (e) { }
    t.disabled = true; t.textContent = 'Conectando…';
    await actualizar(); clearInterval(temporizador); temporizador = setInterval(actualizar, 5000); return;
  }
  if (t.id === 'bCsv') return csv();
  const m = t.dataset.desbloquear || t.dataset.autorizar; if (!m) return;
  t.disabled = true;
  const r = await srv.llamar(t.dataset.desbloquear ? 'desbloquear' : 'autorizar', Object.assign({}, sesion, { matricula: m }));
  toast(r.ok ? (t.dataset.desbloquear ? `Desbloqueado: ${m}. Su examen se abrirá en unos segundos.` : `Salida autorizada: ${m}.`) : 'No se pudo: ' + (r.error || 'error'));
  actualizar();
});

$('pie').textContent = ['Examen virtual', CONFIG.profesor, CONFIG.asignatura].filter(Boolean).join(' · ');
if (srv.activo) pintarAcceso(); else pintarDemo();
