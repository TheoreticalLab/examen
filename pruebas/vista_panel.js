// Panel del profesor en modo real con una clase de ejemplo (servidor simulado), para capturas de pantalla.
import { CONFIG } from '../js/config.js';
import { crearServidorSimulado } from './simulador.js';

const sim = await crearServidorSimulado('../google/Examen.gs', { "const CLAVE_DOCENTE = 'CAMBIA-ESTA-CLAVE'": "const CLAVE_DOCENTE = 'profe'" });
CONFIG.urlServidor = 'https://script.google.com/macros/s/VISTA/exec';
const fetchReal = window.fetch.bind(window);
window.fetch = (u, op) => String(u).startsWith('https://script.google.com/') ? sim.fetch(u, op) : fetchReal(u, op);
const E = (m, nombre) => { const d = { codigo: 'P1-FIS', matricula: m }; sim.llamar('iniciar', Object.assign({ nombre }, d)); return d };
const a = E('2024-0117', 'Ana Pérez'), b = E('2024-0203', 'Luis Gómez'), c = E('2024-0088', 'Marta Ruiz'), d = E('2024-0150', 'Pedro Díaz'), e = E('2024-0021', 'Sara León');
sim.llamar('salida', d); sim.reloj.desfase += 1200; sim.llamar('vuelta', Object.assign({ n: 1, segundos: 1.2 }, d));
sim.reloj.desfase += 300000;
sim.llamar('salida', a); sim.reloj.desfase += 63000; sim.llamar('vuelta', Object.assign({ n: 1, segundos: 63, motivo: 'salió de la app' }, a));
sim.llamar('pedirPermiso', c);
sim.llamar('entregar', Object.assign({ respuestas: {} }, e));
sim.llamar('salida', b); sim.reloj.desfase += 14000;
await import('../js/docente.js');
document.getElementById('aCodigo').value = 'P1-FIS'; document.getElementById('aClave').value = 'profe'; document.getElementById('bAcceso').click();
