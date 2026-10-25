// Prueba de extremo a extremo de la interfaz real (en un iframe), como la usaría un estudiante, en modo demostración.
import { CONFIG } from '../js/config.js';
import { generarProblemas, claveDe, calificar } from '../js/examen.js';
import { num } from '../js/banco.js';

const lineas = []; let pasan = 0, total = 0;
const ok = (c, t) => { total++; if (c) pasan++; lineas.push((c ? 'PASA  ' : 'FALLA ') + t) };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const f = document.getElementById('app');
for (const k of ['examen-virtual-v1', 'examen-virtual-salida']) localStorage.removeItem(k);
let W, D, $, q, qa;
const errores = [];
async function cargar(src) {
  if (src) f.src = src; else W.location.reload();
  await new Promise(r => f.onload = r); await dormir(350);
  W = f.contentWindow; D = f.contentDocument; $ = id => D.getElementById(id); q = s => D.querySelector(s); qa = s => [...D.querySelectorAll(s)];
  W.addEventListener('error', e => errores.push(e.message)); W.addEventListener('unhandledrejection', e => errores.push(String(e.reason)));
}
const clic = async el => { if (typeof el === 'string') el = $(el) || q(el); if (!el) throw new Error('no existe ' + el); el.click(); await dormir(60) };
// teclea como una persona: carácter a carácter (el bloqueo de inserciones de golpe lo exige)
const escribe = async (el, v, añadir = false) => {
  el = typeof el === 'string' ? ($(el) || q(el)) : el; el.focus(); if (!añadir) { el.value = ''; el.dispatchEvent(new W.InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })) }
  for (const ch of String(v)) { el.value += ch; el.dispatchEvent(new W.InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch })); await dormir(4) }
  await dormir(30);
};
const est = () => JSON.parse(W.localStorage.getItem('examen-virtual-v1')).est;
const capaVisible = () => !$('capa').hidden;
const fuera = async ms => { W.dispatchEvent(new W.Event('blur')); await dormir(ms); W.dispatchEvent(new W.Event('focus')); await dormir(250) };

try {
  await cargar('../index.html');
  ok(!!$('bEmpezar') && /DEMO/.test($('app').textContent), 'pantalla de entrada con el código de demostración');
  ok(/Francisco Orbe/.test($('pie').textContent) && /Prof\. Francisco Orbe/.test($('app').textContent), 'nombre del profesor en la entrada y en el pie');
  await clic('bEmpezar'); ok(/Escribe tu nombre/.test(q('.aviso.mal').textContent), 'sin nombre no empieza');
  $('fNombre').value = 'Ana Pérez'; $('fMatricula').value = 'test-001'; $('fCodigo').value = 'XYZ'; $('fAcepto').checked = true;
  await clic('bEmpezar'); await dormir(100); ok(/no es válido/.test(q('.aviso.mal').textContent) && $('fNombre').value === 'Ana Pérez', 'código incorrecto: lo dice y conserva lo escrito');
  $('fCodigo').value = 'demo'; $('fAcepto').checked = false; await clic('bEmpezar'); ok(/reglas/.test(q('.aviso.mal').textContent), 'sin aceptar las reglas no empieza');
  $('fAcepto').checked = true; await clic('bEmpezar'); await dormir(300);
  const P = generarProblemas('DEMO', 'TEST-001', 5);
  ok(/Problema 1 de 5/.test($('app').textContent) && q('.enunciado').textContent === P[0].enunciado, 'empieza: problema 1 de 5, el que le toca a su matrícula');
  ok(/⏱ (20:00|19:5\d)/.test($('cabReloj').textContent) && /TEST-001/.test($('cabAlumno').textContent), 'reloj de 20 min y su nombre y matrícula en la cabecera: ' + $('cabReloj').textContent);

  // calculadora (en un problema numérico)
  const kNum = P.findIndex(p => p.tipo === 'num'); await clic(q(`[data-ir="${kNum}"]`));
  await clic('bCalc'); ok(!$('calc').hidden, 'la calculadora se abre dentro del examen');
  await escribe('cExpr', '12*'); await clic(q('[data-tecla="√("]')); await escribe('cExpr', '4)', true);
  ok($('cExpr').value === '12*√(4)' && $('cRes').textContent === '= 24', 'calculadora: teclas y tecleo se combinan (12*√(4) = 24): ' + $('cExpr').value + ' ' + $('cRes').textContent);
  await escribe('cExpr', '2*(3+'); ok(/incompleta|falta cerrar/.test($('cRes').textContent), 'calculadora: avisa de la expresión incompleta');
  await escribe('cExpr', '9,8*2'); await clic('cUsar'); ok($('resp').value === '19,6', '«Usar el resultado» lo pone como respuesta: ' + $('resp').value);
  await escribe('resp', 'x'); ok(/No es un número/.test($('respEco').textContent), 'una respuesta no numérica se avisa');
  // responder todo: el problema 2 (índice 1) se deja mal a propósito
  for (let k = 0; k < 5; k++) {
    await clic(q(`[data-ir="${k}"]`)); const p = P[k];
    if (p.tipo === 'num') await escribe('resp', k === 1 ? '1' : num(p.respuesta, 3));
    else { const r = q(`input[name="op"][value="${k === 1 ? (p.correcta + 1) % p.opciones.length : p.correcta}"]`); r.click(); await dormir(40) }
  }
  ok(qa('.mapa .hecho').length === 5 && /5 de 5 respondidos/.test($('cuenta').textContent), 'los 5 problemas quedan marcados como respondidos');
  await clic(q('[data-ir="0"]')); ok(P[0].tipo !== 'num' || /Se leerá como/.test($('respEco').textContent), 'al volver a un problema conserva la respuesta');

  // pegar, insertar de golpe, copiar
  const campo = q('#resp') || $('cExpr'); const antes = campo.value; campo.focus();
  const dt = new W.DataTransfer(); dt.setData('text/plain', '42');
  campo.dispatchEvent(new W.ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })); await dormir(50);
  ok(campo.value === antes && /Pegar/.test($('toast').textContent), 'pegar está bloqueado y se avisa');
  campo.value = antes + '1234567'; campo.dispatchEvent(new W.InputEvent('input', { bubbles: true, inputType: 'insertText' })); await dormir(30);
  ok(campo.value === antes, 'un bloque insertado de golpe se deshace');
  D.dispatchEvent(new W.ClipboardEvent('copy', { bubbles: true, cancelable: true })); await dormir(30);
  ok(/Copiar/.test($('toast').textContent) && est().pegados === 3, 'copiar también está desactivado; los tres intentos quedan anotados: ' + est().pegados);

  // salidas
  await fuera(800);
  ok(!capaVisible() && /Saliste 0,[89] s/.test($('toast').textContent) && est().salidas.length === 1, 'salida corta: solo aviso y queda registrada: ' + $('toast').textContent);
  await fuera(2300);
  ok(capaVisible() && $('capa').classList.contains('bloqueo') && /Examen bloqueado/.test($('capa').textContent) && /salida n\.º 2/.test($('capa').textContent) && /2,[3-6] s/.test($('capa').textContent), 'salida de más de 2 s: examen bloqueado con su duración: ' + $('capa').textContent.replace(/\s+/g, ' ').slice(0, 110));
  ok(/TEST-001/.test(q('.ficha').textContent) && /\d+:\d\d/.test($('relojB').textContent), 'la pantalla de bloqueo muestra matrícula y el reloj que sigue corriendo');
  const actual = est().actual; await clic(q(`[data-ir="3"]`)); ok(est().actual === actual, 'bloqueado no puede seguir respondiendo');
  const buena = claveDe(CONFIG.demo.secreto, 'DEMO', 'TEST-001', 'D', 2);
  await escribe('claveD', buena === '1234' ? '4321' : '1234'); await clic('bClave');
  ok(capaVisible() && /incorrecta/.test($('claveMsg').textContent) && est().intentosClave === 1, 'clave incorrecta: sigue bloqueado y se anota');
  await cargar(); ok(capaVisible() && /Examen bloqueado/.test($('capa').textContent), 'recargar la página no quita el bloqueo');
  await escribe('claveD', buena); await clic('bClave'); await dormir(100);
  ok(!capaVisible() && /desbloqueado/.test($('toast').textContent) && est().desbloqueos.length === 1, 'la clave del profesor (de esa salida y esa matrícula) desbloquea');

  // botón atrás
  W.dispatchEvent(new W.PopStateEvent('popstate')); await dormir(80);
  ok(capaVisible() && /Quieres salir del examen/.test($('capa').textContent), '«atrás» no sale: pide confirmación');
  await clic(q('[data-cerrar]')); ok(!capaVisible(), 'y se vuelve al examen');

  // permiso para salir
  await clic('bPermiso'); const nP = +$('capa').textContent.match(/salida n\.º (\d+)/)[1];
  await escribe('claveP', claveDe(CONFIG.demo.secreto, 'DEMO', 'TEST-001', 'P', nP)); await clic('bClaveP'); await dormir(80);
  ok(!capaVisible() && /Tienes permiso/.test($('app').textContent), 'con la clave de permiso puede salir una vez');
  await fuera(2300);
  const u = est().salidas.at(-1);
  ok(!capaVisible() && u.autorizada && !u.bloqueo && /autorizada/.test($('toast').textContent) && !/Tienes permiso/.test($('app').textContent), 'la salida con permiso no bloquea, queda anotada como autorizada y el permiso se gasta');

  // la página se cerró estando fuera (Android la descarta): al reabrir, bloqueado con el tiempo real fuera
  W.dispatchEvent(new W.Event('blur')); await dormir(3000);
  await cargar(); await dormir(100);
  ok(capaVisible() && /Examen bloqueado/.test($('capa').textContent) && / [34](,\d)? s/.test($('capa').textContent) && /se cerró/.test(est().bloqueo.motivo), JSON.stringify(est().bloqueo) + ' · si la app se cerró estando fuera, al reabrir queda bloqueada con el tiempo fuera');
  await escribe('claveD', claveDe(CONFIG.demo.secreto, 'DEMO', 'TEST-001', 'D', est().bloqueo.n)); await clic('bClave'); await dormir(80);
  ok(!capaVisible() && Object.keys(est().respuestas).length === 5, 'tras recargar se conservan las respuestas');

  // entrega
  await clic('bEntregar'); ok(/Has respondido 5 de 5/.test($('capa').textContent), 'entregar pide confirmación con lo respondido');
  await clic('bEntregaSi'); await dormir(100);
  const esperado = calificar(P, est().respuestas).total;
  ok(/Examen entregado/.test($('app').textContent) && q('.nota').textContent.startsWith(String(esperado)) && esperado === 80 && qa('tbody tr').length === 5, `entregado: nota ${q('.nota') && q('.nota').textContent} (una mal de cinco) y el detalle por problema`);
  ok(/Salidas de la app: \d+ \(1 autorizada\) · bloqueos: 2/.test($('app').textContent), 'el resumen de salidas aparece al entregar: ' + (q('.tarjeta p.peq.suave:last-of-type') || {}).textContent);
  await fuera(2300); ok(!capaVisible(), 'después de entregar, salir ya no bloquea');

  // se acaba el tiempo
  await clic('bOtro'); $('fNombre').value = 'Luis Gómez'; $('fMatricula').value = 'TEST-002'; $('fCodigo').value = 'DEMO'; $('fAcepto').checked = true; await clic('bEmpezar'); await dormir(200);
  ok(/Problema 1 de 5/.test($('app').textContent) && q('.enunciado').textContent === generarProblemas('DEMO', 'TEST-002', 5)[0].enunciado, 'otro estudiante: otros problemas');
  { const s = JSON.parse(W.localStorage.getItem('examen-virtual-v1')); s.est.fin = Date.now() - 1000; W.localStorage.setItem('examen-virtual-v1', JSON.stringify(s)) }
  await cargar(); await dormir(700);
  ok(/Se acabó el tiempo/.test($('app').textContent) && est().entregado.auto, 'al acabarse el tiempo se entrega solo');

  // página del profesor (modo demostración): generador de claves
  await cargar('../docente.html');
  $('gMatricula').value = 'test-001'; $('gN').value = '2'; $('gN').dispatchEvent(new W.Event('input', { bubbles: true }));
  const cD = $('gClave').textContent; q('[name="gTipo"][value="P"]').click(); await dormir(50);
  ok(cD === claveDe(CONFIG.demo.secreto, 'DEMO', 'TEST-001', 'D', 2) && $('gClave').textContent === claveDe(CONFIG.demo.secreto, 'DEMO', 'TEST-001', 'P', 2), 'el generador del profesor da las mismas claves que acepta el examen');
  ok(!errores.length, 'sin errores de JavaScript: ' + errores.join(' | '));
} catch (e) { ok(false, 'ERROR ' + (e.stack || e)) }
await fetch('/resultado', { method: 'POST', body: JSON.stringify({ fin: true, lineas, pasan, total }) });
