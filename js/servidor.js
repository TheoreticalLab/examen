// CLIENTE DEL SERVIDOR (Apps Script del profesor). Se envía como texto plano: el navegador no hace consulta previa CORS y
// Apps Script lo acepta. Las salidas se avisan con sendBeacon, que llega aunque la página se esté ocultando.

export const urlValida = u => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u || '');

export function crearCliente({ url, fetch: f = globalThis.fetch && globalThis.fetch.bind(globalThis), beacon = null } = {}) {
  const enviar = async datos => {
    try {
      const r = await f(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos), redirect: 'follow' });
      return await r.json();
    } catch (e) { return { ok: false, error: 'red' } }
  };
  return {
    activo: urlValida(url),
    llamar: (accion, datos = {}) => enviar(Object.assign({ accion }, datos)),
    /** Sin esperar respuesta (al salir de la app). */
    avisar(accion, datos = {}) {
      const cuerpo = JSON.stringify(Object.assign({ accion }, datos));
      try { if (beacon && beacon(url, new Blob([cuerpo], { type: 'text/plain;charset=utf-8' }))) return } catch (e) { }
      enviar(Object.assign({ accion }, datos));
    }
  };
}
