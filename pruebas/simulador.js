// Simulador del Apps Script del profesor: carga google/Examen.gs tal cual y le da hojas de cálculo, cerrojo y respuestas
// de Google simulados, más un reloj controlable (para comprobar que el servidor mide las salidas con su propia hora).

export async function crearServidorSimulado(ruta = '../google/Examen.gs', cambios = {}) {
  let src = await (await fetch(ruta, { cache: 'no-store' })).text();
  for (const [de, a] of Object.entries(cambios)) src = src.replace(de, a);
  const reloj = { desfase: 0, ahora() { return Date.now() + this.desfase } };
  const RealDate = Date;
  class FalsaDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(reloj.ahora()) } static now() { return reloj.ahora() } }
  const hojas = {};
  const hoja = nombre => {
    const filas = [];
    return {
      filas, nombre,
      appendRow: r => filas.push(r.slice()),
      setFrozenRows() { },
      getDataRange: () => ({ getValues: () => filas.map(f => f.slice()) }),
      getRange(f, c, nf, nc) {
        if (typeof f === 'string') return { setNumberFormat() { } };
        return { setValues: v => { for (let i = 0; i < nc; i++) filas[f - 1][c - 1 + i] = v[0][i] } };
      }
    };
  };
  const SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: n => hojas[n] || null, insertSheet: n => (hojas[n] = hoja(n)) }) };
  const LockService = { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) };
  const ContentService = { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType() { return this }, texto: t, getContent: () => t }) };
  const gs = new Function('SpreadsheetApp', 'LockService', 'ContentService', 'Date', src + '\nreturn { doPost, doGet };')(SpreadsheetApp, LockService, ContentService, FalsaDate);
  const llamadas = [];
  const post = cuerpo => { llamadas.push(JSON.parse(cuerpo)); const o = gs.doPost({ postData: { contents: cuerpo } }); return JSON.parse(o.texto) };
  return {
    gs, reloj, hojas, llamadas, post,
    llamar: (accion, datos = {}) => post(JSON.stringify(Object.assign({ accion }, datos))),
    // fetch y sendBeacon falsos para crearCliente / la app en modo real
    fetch: async (url, op) => { await new Promise(r => setTimeout(r, 5)); const j = post(op.body); return { json: async () => j } },
    beacon: (url, blob) => { blob.text().then(post); return true }
  };
}
