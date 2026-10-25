// EXAMEN VIRTUAL · interfaz del estudiante: entrada, problemas, reloj, calculadora, bloqueo al salir, permiso y entrega.
import { CONFIG } from './config.js';
import { crearEstado, anotarSalida, probarClave, probarClavePermiso, quitarBloqueo, concederPermiso, calificar, respondidas, resumenSalidas, normalizarMatricula, normalizarNombre, normalizarCodigo, leerNumero } from './examen.js';
import { num } from './banco.js';
import { calcular, mostrar } from './calculadora.js';
import * as V from './vigilancia.js';
import { crearCliente } from './servidor.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ALM = 'examen-virtual-v1';
const srv = crearCliente({ url: CONFIG.urlServidor, beacon: navigator.sendBeacon ? (u, d) => navigator.sendBeacon(u, d) : null });
const REAL = srv.activo, MAX_INTENTOS = 10;

let S = cargar();                  // { est, offset, titulo, mostrarNota, sucio, enviado, recibo, calc }
const est = () => S && S.est;
function cargar() { try { return JSON.parse(localStorage.getItem(ALM) || 'null') } catch (e) { return null } }
function guardar() { try { localStorage.setItem(ALM, JSON.stringify(S)) } catch (e) { } }
const ahora = () => Date.now() + ((S && S.offset) || 0);
const iso = ms => new Date(ms).toISOString();
const hora = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` };
const seg = s => String(Math.round(s * 10) / 10).replace('.', ',');
const ident = () => ({ codigo: est().codigo, matricula: est().matricula });

const toast = t => { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true }, 6000) };
function capa(html, clase = '') { const c = $('capa'); c.className = 'capa ' + clase; c.innerHTML = `<div class="capa-caja" role="dialog" aria-modal="true">${html}</div>`; c.hidden = false; const f = c.querySelector('input,button'); if (f) f.focus() }
const cerrarCapa = () => { $('capa').hidden = true; $('capa').innerHTML = '' };
const bloqueado = () => !!(est() && est().bloqueo);

/* ---------------- entrada ---------------- */
function pintarEntrada(msg = '') {
  const tol = CONFIG.demo.tolerancia;
  $('app').innerHTML = `<div class="tarjeta"><h1>${esc(REAL ? 'Examen virtual' : CONFIG.demo.titulo)}</h1>
    <p class="suave peq" style="margin-top:-6px">${esc([CONFIG.asignatura, CONFIG.profesor && 'Prof. ' + CONFIG.profesor].filter(Boolean).join(' · '))}</p>
    ${REAL ? '' : `<div class="aviso am">Modo demostración: el código del examen es <b>${esc(CONFIG.demo.codigo)}</b> (${CONFIG.demo.nProblemas} problemas, ${CONFIG.demo.duracionMin} min). Las claves de desbloqueo salen de la <a href="docente.html" target="_blank" rel="noopener">página del profesor</a>.</div>`}
    ${msg ? `<div class="aviso mal" role="alert">${esc(msg)}</div>` : ''}
    <label>Nombre y apellidos<input id="fNombre" autocomplete="name" maxlength="80"></label>
    <label>Matrícula<input id="fMatricula" autocomplete="off" maxlength="20" autocapitalize="characters" spellcheck="false"></label>
    <label>Código del examen (te lo da tu profesor)<input id="fCodigo" autocomplete="off" maxlength="20" autocapitalize="characters" spellcheck="false"></label></div>
    <div class="tarjeta"><h2>Reglas del examen</h2><ul class="reglas">
    <li><b>No salgas de la app.</b> Si sales ${REAL ? 'unos segundos' : tol + ' s'} o más, <b>el examen se bloquea</b> y solo tu profesor puede desbloquearlo. Verá <b>cuánto tiempo</b> estuviste fuera.</li>
    <li>Toda salida queda registrada, aunque sea sin querer. <b>El reloj no se detiene</b> mientras el examen está bloqueado.</li>
    <li>¿Necesitas salir (una llamada, la batería)? Pulsa <b>«Pedir permiso para salir»</b> antes de hacerlo.</li>
    <li>Recargar o cerrar la página también cuenta como salida. El botón «atrás» no sale del examen.</li>
    <li>Usa la <b>calculadora del examen</b> 🧮: no abras la del móvil. Copiar y pegar está desactivado.</li>
    <li>Antes de empezar, <b>cierra las demás apps</b>. Si te llega una notificación, <b>no la toques</b>: abrirla es salir del examen.</li>
    <li>Cuando el navegador lo pregunte, <b>permite las notificaciones</b>: si sales sin querer, el móvil vibrará para avisarte.</li></ul>
    <label class="check"><input type="checkbox" id="fAcepto"> He leído las reglas y las acepto.</label>
    <p><button type="button" class="btn prim ancho" id="bEmpezar">Empezar el examen</button></p></div>`;
}

async function empezar() {
  const nombre = normalizarNombre($('fNombre').value), matricula = normalizarMatricula($('fMatricula').value), codigo = normalizarCodigo($('fCodigo').value);
  if (!nombre) return pintarEntradaCon('Escribe tu nombre y apellidos.');
  if (!matricula) return pintarEntradaCon('Escribe tu matrícula (letras, números o guiones).');
  if (!codigo) return pintarEntradaCon('Escribe el código del examen que te dio tu profesor.');
  if (!$('fAcepto').checked) return pintarEntradaCon('Marca que has leído las reglas.');
  // dentro del clic: el navegador solo concede pantalla completa y notificaciones si las pide un gesto del estudiante
  V.pantallaCompleta(); V.prepararAvisos();   // (si ya se pidió al aceptar las reglas, no vuelve a preguntar)
  $('bEmpezar').disabled = true; $('bEmpezar').textContent = 'Preparando el examen…';
  let cfg, previo = null;
  if (REAL) {
    const t0 = Date.now(), r = await srv.llamar('iniciar', { codigo, matricula, nombre });
    if (!r.ok) return pintarEntradaCon({ codigo: 'Ese código de examen no existe o el examen no está abierto.', 'matricula-en-uso': 'Esa matrícula ya empezó el examen con otro nombre. Habla con tu profesor.', red: 'No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.' }[r.error] || 'No se pudo empezar: ' + r.error);
    cfg = { inicio: r.inicio, fin: r.fin, tolerancia: r.tolerancia, nProblemas: r.nProblemas, titulo: r.titulo, mostrarNota: !!r.mostrarNota, offset: r.ahora - Math.round((t0 + Date.now()) / 2) };
    previo = r.estado || null;
  } else {
    if (codigo !== normalizarCodigo(CONFIG.demo.codigo)) return pintarEntradaCon(`Ese código no es válido. En modo demostración el código es ${CONFIG.demo.codigo}.`);
    const t = Date.now();
    cfg = { inicio: t, fin: t + CONFIG.demo.duracionMin * 60000, tolerancia: CONFIG.demo.tolerancia, nProblemas: CONFIG.demo.nProblemas, titulo: CONFIG.demo.titulo, mostrarNota: CONFIG.demo.mostrarNota, offset: 0 };
  }
  const e = crearEstado({ nombre, matricula, codigo, nProblemas: cfg.nProblemas, inicio: cfg.inicio, fin: cfg.fin, tolerancia: cfg.tolerancia });
  if (previo) for (const k of ['salidas', 'bloqueo', 'desbloqueos', 'intentosClave', 'permiso', 'respuestas', 'entregado']) if (previo[k] != null) e[k] = previo[k];
  S = { est: e, offset: cfg.offset, titulo: cfg.titulo, mostrarNota: cfg.mostrarNota, sucio: false, enviado: !!e.entregado };
  guardar();
  if (e.entregado) return pintarEntregado();
  arrancar();
}
function pintarEntradaCon(msg) {
  const v = { n: $('fNombre').value, m: $('fMatricula').value, c: $('fCodigo').value, a: $('fAcepto').checked };
  pintarEntrada(msg); $('fNombre').value = v.n; $('fMatricula').value = v.m; $('fCodigo').value = v.c; $('fAcepto').checked = v.a;
}

/* ---------------- examen ---------------- */
function arrancar() {
  V.activar(true); V.trampaAtras(); V.mantenerEncendida();
  $('cabAlumno').hidden = false; $('cabAlumno').innerHTML = `${esc(est().nombre)} · <b>${esc(est().matricula)}</b>`; $('cabReloj').hidden = false;
  pintarExamen(); if (bloqueado()) mostrarBloqueo(); else if (est().permiso && est().permiso.pedido && !est().permiso.activo) vigilarPermiso();
  tic(); clearInterval(arrancar.t); arrancar.t = setInterval(tic, 500);
  if (REAL) { clearInterval(arrancar.g); arrancar.g = setInterval(sincronizar, 30000) }
}

function pintarExamen() {
  const e = est(), i = Math.min(e.actual || 0, e.problemas.length - 1), p = e.problemas[i], r = e.respuestas[p.id] ?? '';
  const campo = p.tipo === 'num'
    ? `<label class="resp-lbl" for="resp">Tu respuesta</label><div class="resp"><input id="resp" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="24" value="${esc(r)}"><span class="unidad">${esc(p.unidad)}</span></div><p class="peq suave" id="respEco"></p>`
    : `<fieldset class="opciones"><legend class="resp-lbl">Elige una respuesta</legend>${p.opciones.map((o, k) => `<label class="opcion"><input type="radio" name="op" value="${k}" ${String(r) === String(k) ? 'checked' : ''}> <span>${esc(o)}</span></label>`).join('')}</fieldset>`;
  $('app').innerHTML = `${e.permiso && e.permiso.activo ? `<div class="aviso ok">✅ Tienes permiso para salir una vez. Al volver, el examen no se bloqueará (la salida queda anotada como autorizada).</div>` : ''}
    <div class="tarjeta prob"><div class="prob-cab"><span class="chip">Problema ${i + 1} de ${e.problemas.length}</span><span class="chip tema">${esc(p.tema)}</span></div>
    <p class="enunciado">${esc(p.enunciado)}</p>${campo}
    <div class="fila"><button type="button" class="btn" id="bAnt" ${i === 0 ? 'disabled' : ''}>← Anterior</button><button type="button" class="btn" id="bSig" ${i === e.problemas.length - 1 ? 'disabled' : ''}>Siguiente →</button></div></div>
    <div class="tarjeta calc" id="calc" ${S.calcAbierta ? '' : 'hidden'}><h2>🧮 Calculadora <span class="suave peq">(ángulos en grados)</span></h2>
      <input id="cExpr" autocomplete="off" spellcheck="false" inputmode="text" placeholder="p. ej. 12*sqrt(2*20/9,8)" value="${esc(S.calc || '')}">
      <div class="teclas">${['√(', 'sin(', 'cos(', 'tan(', '^', 'π', '(', ')', 'ans'].map(t => `<button type="button" class="btn chico" data-tecla="${esc(t)}">${esc(t.length > 1 ? t.replace('(', '') : t)}</button>`).join('')}<button type="button" class="btn chico" data-tecla="borrar">⌫</button></div>
      <p class="calc-res" id="cRes" aria-live="polite"></p>
      ${p.tipo === 'num' ? `<button type="button" class="btn chico" id="cUsar">Usar el resultado como respuesta</button>` : ''}</div>
    <div class="tarjeta"><p class="peq suave" style="margin-top:0" id="cuenta">${respondidas(e)} de ${e.problemas.length} respondidos · toca un número para ir a ese problema</p>
      <div class="mapa">${e.problemas.map((q, k) => `<button type="button" class="${k === i ? 'actual' : ''} ${e.respuestas[q.id] != null && e.respuestas[q.id] !== '' ? 'hecho' : ''}" data-ir="${k}" aria-label="Problema ${k + 1}">${k + 1}</button>`).join('')}</div>
      <div class="acciones"><button type="button" class="btn" id="bCalc">🧮 Calculadora</button><button type="button" class="btn" id="bPermiso">Pedir permiso para salir</button><button type="button" class="btn prim" id="bEntregar">Entregar examen</button></div></div>`;
  ecoRespuesta(); calcEco();
}

function ecoRespuesta() {
  const el = $('respEco'), p = est().problemas[est().actual || 0]; if (!el || !p || p.tipo !== 'num') return;
  const v = $('resp').value.trim(), x = leerNumero(v);
  el.textContent = !v ? 'Escribe solo el número (con coma o punto decimal). La unidad ya está puesta.' : x == null ? '⚠️ No es un número válido: escribe solo cifras (p. ej. 12,5 o 3,2e-2).' : `Se leerá como ${String(x).replace('.', ',')} ${p.unidad}.`;
  el.className = 'peq ' + (v && x == null ? 'malt' : 'suave');
}
function calcEco() {
  const el = $('cRes'); if (!el) return; const t = ($('cExpr').value || '').trim();
  if (!t) { el.textContent = '='; delete el.dataset.v; return }
  try { const v = calcular(t, S.ans || 0); el.textContent = '= ' + mostrar(v); el.dataset.v = v; el.className = 'calc-res' } catch (x) { el.textContent = '… ' + x.message; delete el.dataset.v; el.className = 'calc-res suave' }
}

function responder(valor) {
  const e = est(), p = e.problemas[e.actual || 0];
  e.respuestas[p.id] = valor; S.sucio = true; guardar();
  const b = document.querySelector(`[data-ir="${e.actual || 0}"]`); if (b) b.classList.toggle('hecho', valor !== '');
  const t = $('cuenta'); if (t) t.textContent = `${respondidas(e)} de ${e.problemas.length} respondidos · toca un número para ir a ese problema`;
}

function tic() {
  const e = est(); if (!e) return;
  const q = (e.fin - ahora()) / 1000;
  const rj = $('cabReloj'); rj.textContent = '⏱ ' + mmss(q); rj.className = 'reloj' + (q < 60 ? ' urgente' : q < 300 ? ' poco' : '');
  const rb = $('relojB'); if (rb) rb.textContent = mmss(q);
  $('bandaPantalla').hidden = !(V.admitePantallaCompleta() && !document.fullscreenElement && !e.entregado);
  if (q <= 0 && !e.entregado) entregar(true);
}

/* ---------------- salidas y bloqueo ---------------- */
V.configurar({
  alSalir() { if (REAL && est()) srv.avisar('salida', ident()) },
  alVolver(s, fin) { volvio(s, fin) },
  alAtras() {
    if (bloqueado()) return;
    capa(`<h2>¿Quieres salir del examen?</h2><p>Si sales de la app, <b>el examen se bloqueará</b> y tu profesor verá cuánto tiempo estuviste fuera.</p><p>Si de verdad necesitas salir, pide permiso antes.</p><p><button type="button" class="btn prim ancho" data-cerrar>Seguir en el examen</button></p>`)
  },
  alPegar(como) { const e = est(); if (!e) return; e.pegados = (e.pegados || 0) + 1; S.sucio = true; guardar(); toast(como === 'copiar' ? 'Copiar está desactivado durante el examen.' : 'Pegar texto está desactivado: escríbelo tú.') },
  alPantalla() { tic() }
});

async function volvio(s, fin) {
  const e = est(); if (!e || e.entregado) return;
  const segundos = (fin - s.inicio) / 1000; if (segundos < 0.3) return;
  const r = anotarSalida(e, { inicio: iso(s.inicio + ((S && S.offset) || 0)), segundos, motivo: s.motivo });
  guardar(); V.mantenerEncendida();
  if (r.bloquea) mostrarBloqueo();
  else if (r.autorizada) { toast(`Salida autorizada: ${seg(segundos)} s fuera. Queda anotada.`); if (!bloqueado()) pintarExamen() }
  else if (!bloqueado()) toast(`Saliste ${seg(segundos)} s del examen. Queda registrado. Si sales ${e.tolerancia} s o más, el examen se bloquea.`);
  if (REAL) {
    const x = await srv.llamar('vuelta', Object.assign(ident(), { n: r.n, segundos, motivo: s.motivo }));
    // el servidor manda: su reloj mide la salida desde el aviso enviado al salir y su número de salida es el de la clave
    if (x.ok && x.bloqueo && (!e.bloqueo || e.bloqueo.n !== x.bloqueo.n || x.bloqueo.segundos > e.bloqueo.segundos)) { e.bloqueo = x.bloqueo; guardar(); mostrarBloqueo() }
  }
}

function mostrarBloqueo() {
  const e = est(), b = e.bloqueo; if (!b) return;
  const agotado = REAL && e.intentosClave >= MAX_INTENTOS;
  capa(`<div class="candado" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
    <h2>Examen bloqueado</h2>
    <p>Saliste del examen <b>${seg(b.segundos)} s</b> (salida n.º ${b.n}, a las ${esc(hora(b.inicio))}).<br>No puedes continuar hasta que tu profesor te dé una clave.</p>
    <div class="ficha"><span>Nombre</span><b>${esc(e.nombre)}</b><span>Matrícula</span><b>${esc(e.matricula)}</b><span>Salida</span><b>n.º ${b.n} · ${seg(b.segundos)} s</b><span>Quedan</span><b id="relojB">—</b></div>
    <p class="peq">Muéstrale esta pantalla a tu profesor. <b>El reloj del examen sigue corriendo.</b></p>
    ${agotado ? `<div class="aviso mal">Demasiados intentos con clave incorrecta: tu profesor debe desbloquearlo desde su panel.</div>` : `<label>Clave del profesor<input id="claveD" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*"></label>
    <p><button type="button" class="btn prim ancho" id="bClave">Desbloquear</button></p><p class="peq malt" id="claveMsg" role="alert"></p>`}
    ${REAL ? `<p class="peq suave">Tu profesor también puede desbloquearlo desde su panel: se abrirá solo.</p>` : ''}`, 'bloqueo');
  tic();
  if (REAL) { clearInterval(mostrarBloqueo.t); mostrarBloqueo.t = setInterval(async () => {
    if (!bloqueado()) return clearInterval(mostrarBloqueo.t);
    const r = await srv.llamar('estado', ident());
    if (r.ok && !r.bloqueo && bloqueado()) { quitarBloqueo(est(), 'profesor (panel)', iso(ahora())); guardar(); desbloqueado() }
  }, 4000) }
}
async function intentarClave() {
  const e = est(), c = ($('claveD').value || '').trim(); if (!/^\d{4}$/.test(c)) { $('claveMsg').textContent = 'La clave tiene 4 cifras.'; return }
  let ok;
  if (REAL) { $('bClave').disabled = true; const r = await srv.llamar('clave', Object.assign(ident(), { clave: c })); ok = !!r.ok; if (ok) quitarBloqueo(e, 'clave', iso(ahora())); else if (r.error === 'red') { $('bClave').disabled = false; $('claveMsg').textContent = 'Sin conexión: vuelve a intentarlo.'; return } else e.intentosClave = r.intentosClave || e.intentosClave + 1 }
  else ok = probarClave(e, c, CONFIG.demo.secreto, iso(ahora()));
  guardar();
  if (ok) desbloqueado(); else { mostrarBloqueo(); if ($('claveMsg')) $('claveMsg').textContent = 'Clave incorrecta. Queda anotado; pídesela a tu profesor.' }
}
function desbloqueado() { clearInterval(mostrarBloqueo.t); cerrarCapa(); pintarExamen(); toast('Examen desbloqueado. Puedes continuar.') }

/* ---------------- permiso para salir ---------------- */
function pedirPermiso() {
  const e = est();
  if (e.permiso && e.permiso.activo) return toast('Ya tienes permiso para salir una vez.');
  const n = e.salidas.length + 1;
  capa(`<h2>Pedir permiso para salir</h2><p>Avisa a tu profesor de que necesitas salir de la app y por qué. ${REAL ? 'Puede autorizarte desde su panel (esta ventana se cerrará sola) o darte una <b>clave de permiso</b>.' : 'Te dará una <b>clave de permiso</b>.'}</p>
    <div class="ficha"><span>Matrícula</span><b>${esc(e.matricula)}</b><span>Permiso para</span><b>salida n.º ${n}</b></div>
    <label>Clave de permiso<input id="claveP" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]*"></label>
    <p class="fila"><button type="button" class="btn" data-cerrar>Cancelar</button><button type="button" class="btn prim" id="bClaveP">Confirmar permiso</button></p><p class="peq malt" id="clavePMsg" role="alert"></p>
    <p class="peq suave">Hasta que tengas el permiso, <b>no salgas</b>: se bloquearía el examen.</p>`);
  if (REAL) { e.permiso = Object.assign({}, e.permiso, { pedido: iso(ahora()), activo: false }); guardar(); srv.llamar('pedirPermiso', ident()); vigilarPermiso() }
}
function vigilarPermiso() {
  clearInterval(vigilarPermiso.t); vigilarPermiso.t = setInterval(async () => {
    const e = est(); if (!e || e.entregado || (e.permiso && e.permiso.activo)) return clearInterval(vigilarPermiso.t);
    const r = await srv.llamar('estado', ident());
    if (r.ok && r.permiso && r.permiso.activo) { concederPermiso(e, 'profesor (panel)', iso(ahora())); guardar(); permisoConcedido() }
  }, 4000);
}
async function intentarClavePermiso() {
  const e = est(), c = ($('claveP').value || '').trim(); if (!/^\d{4}$/.test(c)) { $('clavePMsg').textContent = 'La clave tiene 4 cifras.'; return }
  let ok;
  if (REAL) { const r = await srv.llamar('clavePermiso', Object.assign(ident(), { clave: c })); ok = !!r.ok; if (ok) concederPermiso(e, 'clave', iso(ahora())); else e.intentosClave = r.intentosClave || e.intentosClave + 1 }
  else ok = probarClavePermiso(e, c, CONFIG.demo.secreto, iso(ahora()));
  guardar();
  if (ok) permisoConcedido(); else $('clavePMsg').textContent = 'Clave incorrecta. Queda anotado.';
}
function permisoConcedido() { clearInterval(vigilarPermiso.t); if (!bloqueado()) { cerrarCapa(); pintarExamen() } toast('Permiso concedido: puedes salir una vez. Al volver, el examen no se bloqueará.') }

/* ---------------- entrega ---------------- */
function confirmarEntrega() {
  const e = est(), n = respondidas(e), t = e.problemas.length;
  capa(`<h2>¿Entregar el examen?</h2><p>Has respondido <b>${n} de ${t}</b> problemas.${n < t ? ' Los que dejes en blanco valen 0.' : ''} Después de entregar no podrás cambiar tus respuestas.</p>
    <p class="fila"><button type="button" class="btn" data-cerrar>Seguir revisando</button><button type="button" class="btn prim" id="bEntregaSi">Entregar</button></p>`);
}
async function entregar(auto) {
  const e = est(); if (!e || e.entregado) return;
  const nota = calificar(e.problemas, e.respuestas);
  e.entregado = { hora: iso(ahora()), auto: !!auto, nota: nota.total, detalle: nota.detalle };
  V.activar(false); V.salirPantallaCompleta(); clearInterval(mostrarBloqueo.t); clearInterval(vigilarPermiso.t); cerrarCapa();
  S.enviado = !REAL; guardar(); pintarEntregado();
  if (REAL) enviarEntrega();
}
async function enviarEntrega() {
  const e = est(), r = await srv.llamar('entregar', Object.assign(ident(), { respuestas: e.respuestas, pegados: e.pegados || 0, auto: e.entregado.auto }));
  if (r.ok) { S.enviado = true; S.recibo = r.recibo; if (r.nota) { e.entregado.nota = r.nota.total; e.entregado.detalle = r.nota.detalle } }
  guardar(); pintarEntregado();
  if (!r.ok) { clearTimeout(enviarEntrega.t); enviarEntrega.t = setTimeout(enviarEntrega, 15000) }
}

function pintarEntregado() {
  const e = est(), R = resumenSalidas(e);
  clearInterval(arrancar.t); clearInterval(arrancar.g); $('cabReloj').hidden = true; $('bandaPantalla').hidden = true;
  $('cabAlumno').hidden = false; $('cabAlumno').innerHTML = `${esc(e.nombre)} · <b>${esc(e.matricula)}</b>`;
  const filas = S.mostrarNota ? e.problemas.map((p, k) => {
    const r = e.respuestas[p.id], d = (e.entregado.detalle || [])[k] || {};
    const tuya = r == null || r === '' ? '<span class="suave">en blanco</span>' : p.tipo === 'num' ? esc(r) + ' ' + esc(p.unidad) : esc(p.opciones[r]);
    const buena = p.tipo === 'num' ? `${num(p.respuesta, 3)} ${esc(p.unidad)}` : esc(p.opciones[p.correcta]);
    return `<tr><td>${k + 1}</td><td>${tuya}</td><td>${buena}</td><td class="num">${String(d.puntos ?? 0).replace('.', ',')}/${String(d.max ?? '').replace('.', ',')}</td></tr>`;
  }).join('') : '';
  $('app').innerHTML = `<div class="tarjeta"><h1>✔ Examen entregado</h1>
    <p>${e.entregado.auto ? 'Se acabó el tiempo y el examen se entregó automáticamente' : 'Entregado'} a las ${esc(hora(e.entregado.hora))}.</p>
    ${REAL ? (S.enviado ? `<div class="aviso ok">Recibido por tu profesor${S.recibo ? ` · recibo <b class="mono">${esc(S.recibo)}</b>` : ''}.</div>` : `<div class="aviso am">Aún no se ha podido enviar a tu profesor (sin conexión). Se reintenta solo; <b>no borres los datos del navegador</b>. <button type="button" class="btn chico" id="bReenviar">Reintentar ahora</button></div>`) : ''}
    ${S.mostrarNota ? `<p class="nota">${String(e.entregado.nota).replace('.', ',')} <small>/ 100</small></p>
    <div class="tabla"><table><thead><tr><th>#</th><th>Tu respuesta</th><th>Correcta</th><th class="num">Puntos</th></tr></thead><tbody>${filas}</tbody></table></div>` : `<p>Tu profesor publicará la nota.</p>`}
    <p class="peq suave">Salidas de la app: ${R.salidas}${R.autorizadas ? ` (${R.autorizadas} autorizada${R.autorizadas > 1 ? 's' : ''})` : ''}${R.bloqueos ? ` · bloqueos: ${R.bloqueos}` : ''} · tiempo fuera: ${R.segundosFuera} s.</p>
    ${REAL ? '' : `<p><button type="button" class="btn" id="bOtro">Hacer otro examen de prueba</button></p>`}</div>`;
}

/* ---------------- sincronización (modo real) ---------------- */
async function sincronizar() {
  const e = est(); if (!e || e.entregado || !S.sucio) return;
  S.sucio = false; guardar();
  const r = await srv.llamar('guardar', Object.assign(ident(), { respuestas: e.respuestas, pegados: e.pegados || 0 }));
  if (!r.ok) { S.sucio = true; guardar() }
}

/* ---------------- eventos ---------------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-ir], [data-tecla], [data-cerrar]'); if (!t) return;
  if (t.hasAttribute('data-cerrar')) return cerrarCapa();
  if (t.id === 'bEmpezar') return empezar();
  if (t.id === 'bClave') return intentarClave();
  if (t.id === 'bClaveP') return intentarClavePermiso();
  if (bloqueado()) return;
  const E = est();
  if (t.dataset.ir != null) { E.actual = +t.dataset.ir; guardar(); return pintarExamen() }
  if (t.id === 'bAnt' || t.id === 'bSig') { E.actual = Math.max(0, Math.min(E.problemas.length - 1, (E.actual || 0) + (t.id === 'bSig' ? 1 : -1))); guardar(); pintarExamen(); window.scrollTo({ top: 0 }); return }
  if (t.id === 'bCalc') { S.calcAbierta = !S.calcAbierta; guardar(); $('calc').hidden = !S.calcAbierta; if (S.calcAbierta) $('cExpr').focus(); return }
  if (t.dataset.tecla) {
    const x = $('cExpr'); x.value = t.dataset.tecla === 'borrar' ? x.value.slice(0, -1) : x.value + t.dataset.tecla; V.fijarValor(x); S.calc = x.value; guardar(); calcEco(); return
  }
  if (t.id === 'cUsar') { const v = $('cRes').dataset.v; if (v == null) return toast('La calculadora no tiene un resultado válido.'); const s = mostrar(+v); S.ans = +v; $('resp').value = s; V.fijarValor($('resp')); responder(s); ecoRespuesta(); return toast('Resultado copiado en tu respuesta: revísalo.') }
  if (t.id === 'bPermiso') return pedirPermiso();
  if (t.id === 'bEntregar') return confirmarEntrega();
  if (t.id === 'bEntregaSi') return entregar(false);
  if (t.id === 'bReenviar') return enviarEntrega();
  if (t.id === 'bOtro') { try { localStorage.removeItem(ALM) } catch (x) { } S = null; $('cabAlumno').hidden = true; return pintarEntrada() }
  if (t.id === 'bPantalla') return V.pantallaCompleta();
});
document.addEventListener('input', e => {
  if (e.target.id === 'resp') { responder(e.target.value.trim()); ecoRespuesta() }
  if (e.target.name === 'op') responder(e.target.value);
  if (e.target.id === 'cExpr') { S.calc = e.target.value; guardar(); calcEco() }
});
document.addEventListener('change', e => {
  if (e.target.name === 'op') responder(e.target.value);
  if (e.target.id === 'fAcepto' && e.target.checked) V.prepararAvisos();   // el permiso de avisos se pide aquí, antes de empezar
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'claveD') intentarClave();
  if (e.target.id === 'claveP') intentarClavePermiso();
  if (e.target.id === 'cExpr') { const v = $('cRes').dataset.v; if (v != null) { S.ans = +v; S.calc = mostrar(+v); e.target.value = S.calc; V.fijarValor(e.target); guardar(); calcEco() } }
});

/* ---------------- arranque ---------------- */
V.instalar();
$('pie').textContent = ['Examen virtual', CONFIG.profesor, CONFIG.asignatura].filter(Boolean).join(' · ');
{
  const pend = V.salidaPendiente(), e = est();
  if (e && !e.entregado) { arrancar(); if (pend) volvio(Object.assign({}, pend, { motivo: (pend.motivo || 'salida') + ' · la página se cerró o se recargó' }), Date.now()) }
  else if (e && e.entregado) { pintarEntregado(); if (REAL && !S.enviado) enviarEntrega() }
  else pintarEntrada();
}
