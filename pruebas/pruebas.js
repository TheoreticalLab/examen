// Pruebas de la lógica: banco de problemas (comprobado contra el propio enunciado), corrección, claves, salidas y bloqueo,
// calculadora y el servidor de Google completo (Examen.gs con servicios simulados).
import { PLANTILLAS, num } from '../js/banco.js';
import * as X from '../js/examen.js';
import { calcular, mostrar } from '../js/calculadora.js';
import { crearCliente } from '../js/servidor.js';
import { crearServidorSimulado } from './simulador.js';

const lineas = []; let pasan = 0, total = 0;
const prueba = async (nombre, f) => { total++; try { const r = await f(); if (r === false) throw new Error('falso'); pasan++; lineas.push('PASA  ' + nombre + (typeof r === 'string' ? ' — ' + r : '')) } catch (e) { lineas.push('FALLA ' + nombre + ' — ' + (e && e.message || e)) } };
const cerca = (a, b, rel, q = '') => { if (!(Math.abs(a - b) <= rel * Math.abs(b))) throw new Error(`${q} ${a} ≠ ${b}`) };
const numeros = t => (t.match(/\d+(?:,\d+)?/g) || []).map(s => Number(s.replace(',', '.')));
const mats = Array.from({ length: 400 }, (_, i) => 'M' + (20240000 + i));

// ======================= 1. BANCO DE PROBLEMAS =======================
// la respuesta se recalcula a partir de los números que LEE el estudiante en el enunciado (no de los internos)
const DESDE_ENUNCIADO = {
  lanzamiento: ([h, v, g]) => v * Math.sqrt(2 * h / g),
  plano: ([m, th, mu, g]) => g * (Math.sin(th * Math.PI / 180) - mu * Math.cos(th * Math.PI / 180)),
  resorte: ([k, xcm, m]) => xcm / 100 * Math.sqrt(k / m),
  periodo: ([m, k]) => 2 * Math.PI * Math.sqrt(m / k),
  choque: ([m1, v1, m2]) => m1 * v1 / (m1 + m2),
  curva: ([R, mu, g]) => Math.sqrt(mu * g * R)
};
await prueba('Banco: cada respuesta numérica coincide con la que se calcula con los datos del enunciado (400 estudiantes)', () => {
  let n = 0;
  for (const m of mats) for (const p of X.generarProblemas('P1', m, PLANTILLAS.length)) {
    if (p.tipo !== 'num') continue;
    const r = DESDE_ENUNCIADO[p.id](numeros(p.enunciado)); cerca(p.respuesta, r, 0.002, p.id + ': ' + p.enunciado);
    if (!(p.respuesta > 0) || !isFinite(p.respuesta)) throw new Error('respuesta no positiva ' + p.id); n++;
  }
  return n + ' problemas numéricos';
});
await prueba('Banco: opción múltiple con la correcta bien marcada, opciones distintas y el orden mezclado entre estudiantes', () => {
  const posiciones = new Set();
  for (const m of mats) for (const p of X.generarProblemas('P1', m, PLANTILLAS.length)) {
    if (p.tipo !== 'opcion') continue;
    if (new Set(p.opciones).size !== p.opciones.length) throw new Error('opciones repetidas ' + p.opciones);
    const c = p.opciones[p.correcta];
    if (p.id === 'periodo-masa') { const [T, f] = numeros(p.enunciado); if (c !== `${num(T * Math.sqrt(f))} s`) throw new Error(p.enunciado + ' → ' + c) }
    if (p.id === 'plano-masa' && c !== 'no cambia') throw new Error(c);
    posiciones.add(p.id + p.correcta);
  }
  return posiciones.size >= 6 ? `la correcta aparece en ${posiciones.size} posiciones distintas` : false;
});
await prueba('Banco: el mismo estudiante recibe siempre lo mismo; otro estudiante, otros números u otro orden', () => {
  const a = JSON.stringify(X.generarProblemas('P1', 'M1', 5)), b = JSON.stringify(X.generarProblemas('P1', 'M1', 5));
  if (a !== b) throw new Error('no reproducible');
  const distintos = new Set(mats.map(m => JSON.stringify(X.generarProblemas('P1', m, 5)))).size;
  const otroExamen = JSON.stringify(X.generarProblemas('P2', 'M1', 5)) !== a;
  return distintos === mats.length && otroExamen ? `${distintos} exámenes distintos de ${mats.length}` : false;
});
await prueba('Banco: 5 problemas sin repetir; todas las plantillas aparecen y en todas las posiciones', () => {
  const vistos = {};
  for (const m of mats) { const ps = X.generarProblemas('P1', m, 5); if (new Set(ps.map(p => p.id)).size !== 5) throw new Error('repetido'); ps.forEach((p, i) => { vistos[p.id] = vistos[p.id] || new Set(); vistos[p.id].add(i) }) }
  return PLANTILLAS.every(t => vistos[t.id] && vistos[t.id].size === 5) ? Object.entries(vistos).map(([k, v]) => k).length + ' plantillas' : false;
});

// ======================= 2. CORRECCIÓN =======================
await prueba('Leer números: coma o punto, signo y notación científica; texto o unidades → no válido', () => {
  const casos = { '12,5': 12.5, '12.5': 12.5, ' -3 ': -3, '1,2e3': 1200, '3.2E-2': 0.032, ',5': 0.5, '7.': 7, 'abc': null, '12 m': null, '1,2,3': null, '': null, '1e': null };
  for (const [t, v] of Object.entries(casos)) if (X.leerNumero(t) !== v) throw new Error(`«${t}» → ${X.leerNumero(t)}`);
});
await prueba('Calificar: exacta y ±2 % valen entero; hasta 5 % la mitad; más, en blanco o no numérica, 0', () => {
  const p = { tipo: 'num', respuesta: 10, tolerancia: 0.02 };
  const c = r => X.calificarProblema(p, r);
  return c('10') === 1 && c('10,19') === 1 && c('9,81') === 1 && c('10,4') === 0.5 && c('9,55') === 0.5 && c('10,6') === 0 && c('') === 0 && c(null) === 0 && c('diez') === 0 && c('-10') === 0;
});
await prueba('Calificar: usar g = 10 en lugar de 9,8 no se penaliza en ningún problema', () => {
  for (const m of mats.slice(0, 100)) for (const p of X.generarProblemas('P1', m, PLANTILLAS.length)) {
    if (p.tipo !== 'num') continue;
    const d = numeros(p.enunciado).map(x => x === 9.8 ? 10 : x); if (!/9,8/.test(p.enunciado)) continue;
    if (X.calificarProblema(p, String(DESDE_ENUNCIADO[p.id](d))) < 0.5) throw new Error(p.id);
  }
});
await prueba('Nota sobre 100: todas bien = 100, todas en blanco = 0, una mal de cinco = 80', () => {
  const ps = X.generarProblemas('P1', 'M7', 5), bien = {}; ps.forEach(p => { bien[p.id] = p.tipo === 'num' ? String(p.respuesta) : String(p.correcta) });
  const casi = Object.assign({}, bien, { [ps[2].id]: ps[2].tipo === 'num' ? '0' : String((ps[2].correcta + 1) % ps[2].opciones.length) });
  return X.calificar(ps, bien).total === 100 && X.calificar(ps, {}).total === 0 && X.calificar(ps, casi).total === 80;
});

// ======================= 3. SALIDAS, BLOQUEO Y CLAVES =======================
const nuevo = () => X.crearEstado({ nombre: 'Ana Pérez', matricula: 'M1', codigo: 'P1', nProblemas: 5, inicio: 0, fin: 1800000, tolerancia: 2 });
await prueba('Claves: 4 cifras; cambian con la matrícula, el examen, el tipo y el n.º de salida', () => {
  const k = (m, c, t, n) => X.claveDe('s', c, m, t, n), b = k('M1', 'P1', 'D', 1);
  if (!/^\d{4}$/.test(b)) throw new Error(b);
  const otros = [k('M2', 'P1', 'D', 1), k('M1', 'P2', 'D', 1), k('M1', 'P1', 'P', 1), k('M1', 'P1', 'D', 2), X.claveDe('t', 'P1', 'M1', 'D', 1)];
  const todas = mats.map(m => k(m, 'P1', 'D', 1)), dist = new Set(todas).size;
  return otros.every(o => o !== b) && dist > 360 ? `${dist} claves distintas para 400 estudiantes` : false;
});
await prueba('Salida corta (< 2 s): se registra y no bloquea; salida larga: bloquea con su n.º y duración', () => {
  const e = nuevo(); const a = X.anotarSalida(e, { inicio: 'x', segundos: 1.2, motivo: 'm' }), b = X.anotarSalida(e, { inicio: 'y', segundos: 63.04, motivo: 'm' });
  return !a.bloquea && b.bloquea && e.bloqueo.n === 2 && e.bloqueo.segundos === 63 && e.salidas.length === 2;
});
await prueba('Desbloqueo: clave incorrecta se anota; la de otra salida o de otro estudiante no sirve; la correcta desbloquea', () => {
  const e = nuevo(); X.anotarSalida(e, { inicio: 'x', segundos: 5 }); X.anotarSalida(e, { inicio: 'x', segundos: 9 });
  const mal = X.probarClave(e, '0000', 's', 'h') || X.probarClave(e, X.claveDe('s', 'P1', 'M1', 'D', 1), 's', 'h') || X.probarClave(e, X.claveDe('s', 'P1', 'M2', 'D', 2), 's', 'h');
  const bien = X.probarClave(e, X.claveDe('s', 'P1', 'M1', 'D', 2), 's', 'h');
  return !mal && bien && !e.bloqueo && e.intentosClave === 3 && e.desbloqueos[0].n === 2;
});
await prueba('Permiso: la siguiente salida queda autorizada y no bloquea; el permiso se gasta en una sola salida', () => {
  const e = nuevo();
  if (X.probarClavePermiso(e, X.claveDe('s', 'P1', 'M1', 'P', 2), 's', 'h')) throw new Error('aceptó la clave de otra salida');
  if (!X.probarClavePermiso(e, X.claveDe('s', 'P1', 'M1', 'P', 1), 's', 'h')) throw new Error('rechazó la buena');
  const a = X.anotarSalida(e, { inicio: 'x', segundos: 40 }), b = X.anotarSalida(e, { inicio: 'x', segundos: 40 });
  return a.autorizada && !a.bloquea && !b.autorizada && b.bloquea && e.permiso.activo === false && e.permiso.usadoEn === 1;
});
await prueba('Después de entregar, salir ya no bloquea', () => { const e = nuevo(); e.entregado = { hora: 'h' }; return !X.anotarSalida(e, { inicio: 'x', segundos: 100 }).bloquea });

// ======================= 4. CALCULADORA =======================
await prueba('Calculadora: precedencia, potencias, funciones en grados, π, coma decimal y multiplicación implícita', () => {
  const casos = [['2+3*4', 14], ['2^3^2', 512], ['-2^2', -4], ['(-2)^2', 4], ['sqrt(16)', 4], ['√16', 4], ['√(9)+1', 4], ['sin(30)', 0.5], ['cos(60)', 0.5], ['tan(45)', 1], ['asin(0,5)', 30],
    ['12*sqrt(2*20/9,8)', 12 * Math.sqrt(40 / 9.8)], ['2π', 2 * Math.PI], ['3(4+1)', 15], ['1,5e2', 150], ['ln(e)', 1], ['log(1000)', 3], ['10÷4×2', 5], ['5−7', -2], ['ans*2', 6]];
  for (const [t, v] of casos) cerca(calcular(t, 3), v, 1e-12, t);
  return mostrar(2 * Math.PI) === '6,28319';
});
await prueba('Calculadora: expresiones incompletas o no válidas dan un mensaje, no un número', () => {
  for (const t of ['2+', '(2', '2)', 'foo(2)', '1/0', 'sin 30', '2$3', '']) { let fallo = false; try { calcular(t) } catch (e) { fallo = !!e.message } if (!fallo) throw new Error(t) }
});

// ======================= 5. SERVIDOR DE GOOGLE (Examen.gs con servicios simulados) =======================
const sim = await crearServidorSimulado('../google/Examen.gs', { "const CLAVE_DOCENTE = 'CAMBIA-ESTA-CLAVE'": "const CLAVE_DOCENTE = 'profe'", "const SECRETO = 'CAMBIA-ESTE-SECRETO-LARGO'": "const SECRETO = 'secreto-prueba'" });
const L = (a, d) => sim.llamar(a, d), yo = { codigo: 'P1-FIS', matricula: '2024-0001' };
const panel = () => L('panel', { claveDocente: 'profe', codigo: 'P1-FIS' }), fila = m => panel().estudiantes.find(e => e.matricula === m);
await prueba('Servidor: rechaza código inexistente, nombre vacío y clave docente incorrecta (o sin cambiar)', () => {
  const a = L('iniciar', { codigo: 'NO', matricula: 'x1', nombre: 'Ana' }), b = L('iniciar', Object.assign({ nombre: ' ' }, yo)), c = L('panel', { claveDocente: 'mal', codigo: 'P1-FIS' });
  return a.error === 'codigo' && b.error === 'nombre' && c.error === 'clave';
});
let ini;
await prueba('Servidor: iniciar fija la hora oficial (30 min) y los problemas coinciden con los de la app', () => {
  ini = L('iniciar', Object.assign({ nombre: 'Ana Pérez' }, yo));
  const h = sim.hojas.Examenes, est = JSON.parse(h.filas[1][13]);
  return ini.ok && ini.fin - ini.inicio === 30 * 60000 && ini.nProblemas === 5 && ini.mostrarNota === false && JSON.stringify(est.problemas) === JSON.stringify(X.generarProblemas('P1-FIS', '2024-0001', 5)) && h.filas[0][0] === 'Examen';
});
await prueba('Servidor: una salida corta no bloquea', () => { L('salida', yo); sim.reloj.desfase += 1000; const r = L('vuelta', Object.assign({ n: 1, segundos: 1, motivo: 'm' }, yo)); return r.ok && !r.bloqueo && r.salidas === 1 });
await prueba('Servidor: mide la salida con SU reloj: si la app dice 3 s pero estuvo 70 s fuera, cuenta 70 s y bloquea', () => {
  L('salida', yo); sim.reloj.desfase += 30000;
  const f = fila('2024-0001'); if (f.fueraAhora !== 30) throw new Error('el panel no ve que está fuera ahora: ' + f.fueraAhora);
  sim.reloj.desfase += 40000; const r = L('vuelta', Object.assign({ n: 2, segundos: 3, motivo: 'salió' }, yo));
  return r.ok && r.bloqueo && r.bloqueo.n === 2 && r.bloqueo.segundos === 70 && /medida por el servidor/.test(r.bloqueo.motivo);
});
await prueba('Servidor: el panel muestra el bloqueo, la duración y la clave de esa salida', () => {
  const f = fila('2024-0001');
  return f.bloqueo.segundos === 70 && f.claveDesbloqueo === X.claveDe('secreto-prueba', 'P1-FIS', '2024-0001', 'D', 2) && f.fueraAhora === null && f.salidas.length === 2 && sim.hojas.Examenes.filas[1][5] === 'BLOQUEADO';
});
await prueba('Servidor: clave incorrecta → no desbloquea y cuenta el intento; la correcta (dictada por el profesor) desbloquea', () => {
  const a = L('clave', Object.assign({ clave: '0000' }, yo)), b = L('clave', Object.assign({ clave: fila('2024-0001').claveDesbloqueo }, yo));
  return a.ok === false && a.intentosClave === 1 && a.bloqueo && b.ok === true && b.bloqueo === null;
});
await prueba('Servidor: el botón «Desbloquear» del panel desbloquea sin clave', () => {
  L('salida', yo); sim.reloj.desfase += 10000; L('vuelta', Object.assign({ n: 3, segundos: 10 }, yo));
  const antes = L('estado', yo).bloqueo, r = L('desbloquear', Object.assign({ claveDocente: 'profe' }, yo)), despues = L('estado', yo).bloqueo;
  return antes && r.ok && despues === null && fila('2024-0001').desbloqueos.some(d => /panel/.test(d.como));
});
await prueba('Servidor: pedir permiso aparece en el panel; «Autorizar» hace que la siguiente salida no bloquee', () => {
  L('pedirPermiso', yo); const f = fila('2024-0001'); if (!(f.permiso.pedido && !f.permiso.activo)) throw new Error('no aparece la petición');
  L('autorizar', Object.assign({ claveDocente: 'profe' }, yo)); if (!L('estado', yo).permiso.activo) throw new Error('no se activó');
  L('salida', yo); sim.reloj.desfase += 45000; const r = L('vuelta', Object.assign({ n: 4, segundos: 45 }, yo)); const g = fila('2024-0001');
  return r.ok && !r.bloqueo && g.salidas[3].autorizada && !g.permiso.activo && !g.permiso.pedido;
});
await prueba('Servidor: entrar otra vez con la misma matrícula y otro nombre se rechaza', () => L('iniciar', Object.assign({ nombre: 'Otra Persona' }, yo)).error === 'matricula-en-uso');
await prueba('Servidor: salir y volver a entrar desde el inicio (otro móvil o datos borrados) no esquiva el bloqueo', () => {
  L('salida', yo); sim.reloj.desfase += 50000;
  const r = L('iniciar', Object.assign({ nombre: 'ana pérez' }, yo));
  return r.ok && r.estado && r.estado.bloqueo && r.estado.bloqueo.segundos === 50 && /volvió a entrar/.test(r.estado.bloqueo.motivo) && r.fin === ini.fin && fila('2024-0001').reentradas === 1;
});
await prueba('Servidor: tras 10 claves incorrectas ya no acepta más (hay que usar el panel)', () => {
  for (let i = 0; i < 12; i++) L('clave', Object.assign({ clave: '0000' }, yo));
  const r = L('clave', Object.assign({ clave: fila('2024-0001').claveDesbloqueo }, yo));
  return r.error === 'intentos' && L('estado', yo).bloqueo;
});
await prueba('Servidor: guardar y entregar; la nota del servidor es la de las reglas compartidas; entregar dos veces no cambia nada', () => {
  L('desbloquear', Object.assign({ claveDocente: 'profe' }, yo));
  const ps = X.generarProblemas('P1-FIS', '2024-0001', 5), resp = {}; ps.forEach((p, i) => { resp[p.id] = i === 0 ? 'nada' : p.tipo === 'num' ? num(p.respuesta, 3) : String(p.correcta) });
  resp.inventado = '99';
  L('guardar', Object.assign({ respuestas: resp }, yo));
  const a = L('entregar', Object.assign({ respuestas: resp }, yo)), est = JSON.parse(sim.hojas.Examenes.filas[1][13]);
  const b = L('entregar', Object.assign({ respuestas: {} }, yo));
  return a.ok && a.nota === null && /^R-\d{6}$/.test(a.recibo) && b.recibo === a.recibo && est.entregado.nota === X.calificar(ps, resp).total && est.entregado.nota === 80 && !('inventado' in est.respuestas) && sim.hojas.Examenes.filas[1][10] === 80;
});
await prueba('Servidor: entregar después del tiempo (más 90 s de gracia) queda marcado como tarde', () => {
  const m = { codigo: 'P1-FIS', matricula: '2024-0002' }; L('iniciar', Object.assign({ nombre: 'Luis Gómez' }, m));
  sim.reloj.desfase += 32 * 60000; L('entregar', Object.assign({ respuestas: {} }, m));
  return fila('2024-0002').entregado.tarde === true && fila('2024-0001').entregado.tarde === false;
});
await prueba('Servidor: una matrícula solo de cifras no pierde ceros (columna en texto) y se encuentra igual', () => {
  const m = { codigo: 'P1-FIS', matricula: '00123' }; const a = L('iniciar', Object.assign({ nombre: 'Eva Ruiz' }, m)); const b = L('estado', m);
  return a.ok && b.ok && fila('00123').nombre === 'Eva Ruiz';
});
await prueba('Cliente: crearCliente habla con el servidor (fetch) y avisa las salidas con sendBeacon (texto plano)', async () => {
  const c = crearCliente({ url: 'https://script.google.com/macros/s/ABC_123-x/exec', fetch: sim.fetch, beacon: sim.beacon });
  const m = { codigo: 'P1-FIS', matricula: '2024-0003' };
  const a = await c.llamar('iniciar', Object.assign({ nombre: 'Sara Díaz' }, m));
  c.avisar('salida', m); await new Promise(r => setTimeout(r, 30));
  const abierta = fila('2024-0003').fueraAhora;
  const sinUrl = crearCliente({ url: '' }).activo, red = await crearCliente({ url: 'https://script.google.com/macros/s/A/exec', fetch: async () => { throw new Error('x') } }).llamar('estado');
  return c.activo && a.ok && abierta === 0 && sinUrl === false && red.error === 'red';
});

await fetch('/resultado', { method: 'POST', body: JSON.stringify({ fin: true, lineas, pasan, total }) });
