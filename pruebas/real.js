// La app del estudiante en MODO REAL contra el Apps Script del profesor (Examen.gs con servicios de Google simulados).
// El profesor actúa a través del mismo servidor (panel, desbloquear, autorizar), como haría desde su móvil.
import { CONFIG } from '../js/config.js';
import { generarProblemas, calificar } from '../js/examen.js';
import { num } from '../js/banco.js';
import { crearServidorSimulado } from './simulador.js';

const fetchReal = window.fetch.bind(window);
const lineas = []; let pasan = 0, total = 0;
const ok = (c, t) => { total++; if (c) pasan++; lineas.push((c ? 'PASA  ' : 'FALLA ') + t) };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const errores = []; window.addEventListener('error', e => errores.push(e.message));
const sim = await crearServidorSimulado('../google/Examen.gs', { "const CLAVE_DOCENTE = 'CAMBIA-ESTA-CLAVE'": "const CLAVE_DOCENTE = 'profe'", "const SECRETO = 'CAMBIA-ESTE-SECRETO-LARGO'": "const SECRETO = 'secreto-prueba'" });
CONFIG.urlServidor = 'https://script.google.com/macros/s/PRUEBA_real/exec';
window.fetch = (u, op) => String(u).startsWith('https://script.google.com/') ? sim.fetch(u, op) : fetchReal(u, op);
Object.defineProperty(navigator, 'sendBeacon', { value: (u, b) => sim.beacon(u, b), configurable: true });
for (const k of ['examen-virtual-v1', 'examen-virtual-salida']) localStorage.removeItem(k);
await import('../js/app.js');

const $ = id => document.getElementById(id), q = s => document.querySelector(s);
const clic = async el => { if (typeof el === 'string') el = $(el) || q(el); el.click(); await dormir(80) };
const escribe = async (id, v) => { const el = $(id); el.focus(); el.value = ''; for (const ch of String(v)) { el.value += ch; el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch })); await dormir(3) } await dormir(30) };
const capaVisible = () => !$('capa').hidden;
const yo = { codigo: 'P1-FIS', matricula: 'R-001' };
const profe = (accion, d = {}) => sim.llamar(accion, Object.assign({ claveDocente: 'profe' }, yo, d));
const fila = () => profe('panel').estudiantes.find(e => e.matricula === 'R-001');
const esperar = async (cond, ms = 6000) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await dormir(100); return cond() };

try {
  ok(!/Modo demostración/.test($('app').textContent), 'en modo real no aparece el aviso de demostración');
  $('fNombre').value = 'Rosa Marte'; $('fMatricula').value = 'r-001'; $('fCodigo').value = 'P1-FIS'; $('fAcepto').checked = true;
  await clic('bEmpezar'); await esperar(() => /Problema 1 de 5/.test($('app').textContent));
  const P = generarProblemas('P1-FIS', 'R-001', 5);
  ok(q('.enunciado') && q('.enunciado').textContent === P[0].enunciado && /⏱ (30:00|29:5\d)/.test($('cabReloj').textContent), 'empieza con la hora del servidor (30 min) y los problemas de su matrícula');
  ok(fila() && fila().nombre === 'Rosa Marte', 'el profesor ya la ve en su panel');

  // salida corta
  window.dispatchEvent(new Event('blur')); await dormir(700); window.dispatchEvent(new Event('focus')); await dormir(300);
  ok(!capaVisible() && fila().salidas.length === 1 && !fila().bloqueo, 'salida corta: el servidor la registra y no bloquea');
  // el servidor mide más tiempo fuera que el móvil (p. ej. cambió el reloj del teléfono): manda el servidor
  window.dispatchEvent(new Event('blur')); await dormir(150);
  ok(fila().fueraAhora != null, 'mientras está fuera, el panel del profesor lo muestra como «fuera ahora»');
  sim.reloj.desfase += 60000; await dormir(150); window.dispatchEvent(new Event('focus'));
  await esperar(() => capaVisible());
  ok(capaVisible() && /Examen bloqueado/.test($('capa').textContent) && /6\d(,\d)? s/.test($('capa').textContent), 'el móvil midió 0,3 s pero el servidor 60 s: el examen se bloquea con la duración del servidor: ' + $('capa').textContent.replace(/\s+/g, ' ').slice(0, 70));
  const f1 = fila(); ok(f1.bloqueo && f1.claveDesbloqueo && /^\d{4}$/.test(f1.claveDesbloqueo), 'el panel muestra el bloqueo y la clave para dictar: ' + f1.claveDesbloqueo);
  // el profesor pulsa «Desbloquear» en su panel: el examen se abre solo
  profe('desbloquear');
  ok(await esperar(() => !capaVisible(), 6000) && /desbloqueado/.test($('toast').textContent), 'el profesor pulsa «Desbloquear» en su panel y el examen del estudiante se abre solo');

  // otra salida larga; clave incorrecta y luego la dictada por el profesor (verificada en el servidor)
  window.dispatchEvent(new Event('blur')); await dormir(2300); window.dispatchEvent(new Event('focus')); await esperar(() => capaVisible());
  await escribe('claveD', '0000'); await clic('bClave'); await esperar(() => /incorrecta/.test(($('claveMsg') || {}).textContent || ''));
  ok(capaVisible() && fila().resumen.intentosClave === 1, 'clave incorrecta: sigue bloqueado y el servidor la cuenta');
  await escribe('claveD', fila().claveDesbloqueo); await clic('bClave'); await esperar(() => !capaVisible());
  ok(!capaVisible() && !fila().bloqueo, 'la clave que dicta el profesor (verificada por el servidor) desbloquea');

  // permiso para salir autorizado desde el panel
  await clic('bPermiso'); await dormir(150);
  ok(fila().permiso && fila().permiso.pedido, 'pedir permiso aparece en el panel del profesor');
  profe('autorizar'); ok(await esperar(() => !capaVisible() && /Tienes permiso/.test($('app').textContent), 6000), 'el profesor autoriza desde el panel y el estudiante lo ve sin escribir clave');
  window.dispatchEvent(new Event('blur')); await dormir(2300); window.dispatchEvent(new Event('focus')); await dormir(400);
  ok(!capaVisible() && fila().salidas.at(-1).autorizada && !fila().bloqueo, 'la salida autorizada no bloquea y queda anotada así en el servidor');

  // responder y entregar
  for (let k = 0; k < 5; k++) {
    await clic(q(`[data-ir="${k}"]`)); const p = P[k];
    if (p.tipo === 'num') await escribe('resp', num(p.respuesta, 3)); else { q(`input[name="op"][value="${p.correcta}"]`).click(); await dormir(30) }
  }
  await clic('bEntregar'); await clic('bEntregaSi'); await esperar(() => /Recibido por tu profesor/.test($('app').textContent));
  const F = fila();
  ok(/Recibido por tu profesor/.test($('app').textContent) && $('app').textContent.includes(F.entregado.recibo), 'entregado: el estudiante ve el recibo del servidor: ' + F.entregado.recibo);
  ok(F.entregado.nota === 100 && /publicará la nota/.test($('app').textContent), 'el servidor corrige (100) y, como el examen no muestra la nota, el estudiante no la ve');
  ok(sim.hojas.Examenes.filas[1][5] === 'Entregado' && sim.hojas.Examenes.filas[1][10] === 100, 'la hoja de cálculo del profesor tiene la fila con estado y nota');
  ok(!errores.length, 'sin errores de JavaScript: ' + errores.join(' | '));
} catch (e) { ok(false, 'ERROR ' + (e.stack || e)) }
await fetchReal('/resultado', { method: 'POST', body: JSON.stringify({ fin: true, lineas, pasan, total }) });
