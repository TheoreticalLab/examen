// Azar reproducible: los problemas de cada estudiante salen de «código del examen | matrícula» (semilla).
// sfc32 alimentado con cyrb128: rápido, de buena calidad estadística y sin dependencias. El mismo código corre en el
// navegador y en el Apps Script del profesor (construir.py lo copia), así ambos generan exactamente los mismos problemas.

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Huella numérica de un texto (32 bits). */
export function huella(texto) { return cyrb128(String(texto))[0] }

/** Generador con semilla de texto. Misma semilla → misma secuencia, en cualquier navegador y en Apps Script. */
export function crearAzar(semilla) {
  const r = sfc32(...cyrb128(String(semilla)));
  for (let i = 0; i < 12; i++) r();
  return {
    siguiente: r,
    entero: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
    // valor en [lo, hi] redondeado al paso (p. ej. 0,05): los enunciados llevan números «de examen»
    paso: (lo, hi, p) => Math.round((lo + (hi - lo) * r()) / p) * p,
    elegir: arr => arr[Math.floor(r() * arr.length)],
    mezclar: arr => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  };
}
