// Prepara un estado de demostración en el navegador y abre la app (para capturas de pantalla): vista.html?v=examen|bloqueo|entregado|entrada
import { crearEstado, anotarSalida, generarProblemas, calificar } from '../js/examen.js';
import { num } from '../js/banco.js';

const v = new URLSearchParams(location.search).get('v') || 'entrada', t = Date.now();
for (const k of ['examen-virtual-v1', 'examen-virtual-salida']) localStorage.removeItem(k);
if (v !== 'entrada') {
  const est = crearEstado({ nombre: 'Ana Pérez', matricula: '2024-0117', codigo: 'DEMO', nProblemas: 5, inicio: t - 6 * 60000, fin: t + 14 * 60000 + 12000, tolerancia: 2 });
  const P = est.problemas; P.forEach((p, i) => { if (i < 3) est.respuestas[p.id] = p.tipo === 'num' ? num(p.respuesta, 3) : String(p.correcta) });
  est.actual = P.findIndex(p => p.tipo === 'num');
  anotarSalida(est, { inicio: new Date(t - 200000).toISOString(), segundos: 1.2, motivo: 'la ventana perdió el foco' });
  if (v === 'bloqueo') anotarSalida(est, { inicio: new Date(t - 70000).toISOString(), segundos: 63.4, motivo: 'salió de la app (otra app o pestaña)' });
  const S = { est, offset: 0, titulo: 'Examen de demostración', mostrarNota: true, calcAbierta: v === 'examen', calc: '12*sqrt(2*20/9,8)' };
  if (v === 'entregado') { const n = calificar(P, est.respuestas); est.entregado = { hora: new Date(t).toISOString(), auto: false, nota: n.total, detalle: n.detalle } }
  localStorage.setItem('examen-virtual-v1', JSON.stringify(S));
}
location.replace(v === 'docente' ? '../docente.html' : '../index.html');
