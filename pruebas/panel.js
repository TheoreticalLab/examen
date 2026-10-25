// El panel del profesor (docente.html) en MODO REAL contra Examen.gs simulado, con estudiantes en cada situación.
import { CONFIG } from '../js/config.js';
import { crearServidorSimulado } from './simulador.js';

const fetchReal = window.fetch.bind(window);
const lineas = []; let pasan = 0, total = 0;
const ok = (c, t) => { total++; if (c) pasan++; lineas.push((c ? 'PASA  ' : 'FALLA ') + t) };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const errores = []; window.addEventListener('error', e => errores.push(e.message));
const sim = await crearServidorSimulado('../google/Examen.gs', { "const CLAVE_DOCENTE = 'CAMBIA-ESTA-CLAVE'": "const CLAVE_DOCENTE = 'profe'", "const SECRETO = 'CAMBIA-ESTE-SECRETO-LARGO'": "const SECRETO = 'secreto-prueba'" });
CONFIG.urlServidor = 'https://script.google.com/macros/s/PRUEBA_panel/exec';
window.fetch = (u, op) => String(u).startsWith('https://script.google.com/') ? sim.fetch(u, op) : fetchReal(u, op);
const descargas = []; HTMLAnchorElement.prototype.click = function () { descargas.push(this.download) };

// estudiantes: bloqueado (63 s fuera), fuera ahora, pide permiso, en curso, entregado
const E = (m, nombre) => { const d = { codigo: 'P1-FIS', matricula: m }; sim.llamar('iniciar', Object.assign({ nombre }, d)); return d };
const a = E('A-1', 'Zoe Bloqueada'), b = E('B-2', 'Yago Fuera'), c = E('C-3', 'Xenia Permiso'), d = E('D-4', 'Abel Curso'), e = E('E-5', 'Bea Entregada');
sim.llamar('salida', a); sim.reloj.desfase += 63000; sim.llamar('vuelta', Object.assign({ n: 1, segundos: 63, motivo: 'salió de la app' }, a));
sim.llamar('pedirPermiso', c);
sim.llamar('entregar', Object.assign({ respuestas: {} }, e));
sim.llamar('salida', b); sim.reloj.desfase += 12000;

await import('../js/docente.js');
const $ = id => document.getElementById(id), q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const esperar = async (cond, ms = 4000) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await dormir(50); return cond() };
try {
  ok(!!$('bAcceso') && !$('gClave'), 'en modo real pide el código del examen y la clave del profesor (sin generador de demostración)');
  $('aCodigo').value = 'p1-fis'; $('aClave').value = 'mala'; $('bAcceso').click();
  ok(await esperar(() => /incorrecta/.test($('panel').textContent)), 'clave del profesor incorrecta: no muestra nada');
  $('aCodigo').value = 'P1-FIS'; $('aClave').value = 'profe'; $('bAcceso').click();
  await esperar(() => qa('#panel .tarjeta').length >= 6);
  const tarjetas = qa('#panel .tarjeta').slice(1).map(t => t.textContent.replace(/\s+/g, ' '));
  ok(tarjetas.length === 5 && /Zoe/.test(tarjetas[0]) && /Yago/.test(tarjetas[1]) && /Xenia/.test(tarjetas[2]) && /Abel/.test(tarjetas[3]) && /Bea/.test(tarjetas[4]), 'orden: bloqueados, fuera ahora, piden permiso, en curso, entregados');
  const claveA = sim.llamar('panel', { claveDocente: 'profe', codigo: 'P1-FIS' }).estudiantes.find(x => x.matricula === 'A-1').claveDesbloqueo;
  ok(/BLOQUEADO/.test(tarjetas[0]) && /63 s fuera/.test(tarjetas[0]) && tarjetas[0].includes(claveA) && /Desbloquear/.test(tarjetas[0]), 'bloqueado: duración (63 s), clave para dictar y botón Desbloquear');
  ok(/FUERA AHORA · 12 s/.test(tarjetas[1]), 'el que está fuera en este momento aparece con los segundos que lleva fuera');
  ok(/Pide permiso/.test(tarjetas[2]) && /Autorizar salida/.test(tarjetas[2]), 'la petición de permiso aparece con su clave y el botón Autorizar');
  ok(/Entregado/.test(tarjetas[4]) && /Nota: 0/.test(tarjetas[4]) && /1 bloqueados · 1 fuera ahora · 1 piden permiso · 1 en curso · 1 entregados/.test($('panel').textContent), 'entregado con su nota y el resumen de la clase');
  ok(/^🔒 1/.test(document.title), 'el título de la pestaña avisa de cuántos hay bloqueados');
  q('[data-desbloquear="A-1"]').click(); await esperar(() => /Desbloqueado/.test($('toast').textContent));
  ok(!sim.llamar('estado', a).bloqueo && /Desbloqueado: A-1/.test($('toast').textContent), 'el botón Desbloquear desbloquea al estudiante en el servidor');
  q('[data-autorizar="C-3"]').click(); await esperar(() => /autorizada/.test($('toast').textContent));
  ok(sim.llamar('estado', c).permiso.activo, 'el botón Autorizar salida concede el permiso');
  await esperar(() => !/BLOQUEADO/.test($('panel').textContent));
  ok(!/BLOQUEADO/.test($('panel').textContent), 'la lista se actualiza sola');
  $('bCsv').click(); ok(descargas[0] === 'examen-P1-FIS.csv', 'descarga el CSV de la clase');
  ok(!errores.length, 'sin errores de JavaScript: ' + errores.join(' | '));
} catch (x) { ok(false, 'ERROR ' + (x.stack || x)) }
await fetchReal('/resultado', { method: 'POST', body: JSON.stringify({ fin: true, lineas, pasan, total }) });
