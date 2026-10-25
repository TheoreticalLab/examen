// CALCULADORA CIENTÍFICA del examen (así nadie tiene que salir a la del móvil). Analizador propio, sin eval (la CSP lo
// prohíbe y no hace falta). Ángulos en grados. Admite coma o punto decimal, × ÷ −, √, ^, π, e, ans y
// sqrt sin cos tan asin acos atan ln log abs.

const FUNCIONES = {
  sqrt: Math.sqrt, raiz: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10,
  sin: x => Math.sin(x * Math.PI / 180), sen: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180),
  asin: x => Math.asin(x) * 180 / Math.PI, acos: x => Math.acos(x) * 180 / Math.PI, atan: x => Math.atan(x) * 180 / Math.PI
};

function fichas(t) {
  const s = String(t).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, ''), out = [];
  let i = 0;
  while (i < s.length) {
    const resto = s.slice(i);
    let m = resto.match(/^(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?/i);
    if (m) { out.push({ t: 'n', v: Number(m[0].replace(',', '.')) }); i += m[0].length; continue }
    m = resto.match(/^([a-zA-Z]+|π|√)/);
    if (m) { out.push({ t: 'id', v: m[0].toLowerCase() }); i += m[0].length; continue }
    if ('+-*/^()'.includes(s[i])) { out.push({ t: s[i] }); i++; continue }
    throw new Error('símbolo no válido: ' + s[i]);
  }
  return out;
}

/** Valor numérico de la expresión; lanza un error con mensaje legible si no es válida. */
export function calcular(expr, ans = 0) {
  const f = fichas(expr); let i = 0;
  const ve = t => f[i] && f[i].t === t, toma = t => { if (!ve(t)) throw new Error(t === ')' ? 'falta cerrar un paréntesis' : 'expresión incompleta'); i++ };
  function suma() { let v = producto(); while (ve('+') || ve('-')) { const o = f[i++].t, w = producto(); v = o === '+' ? v + w : v - w } return v }
  function producto() {
    let v = unario();
    for (;;) {
      if (ve('*') || ve('/')) { const o = f[i++].t, w = unario(); v = o === '*' ? v * w : v / w }
      else if (f[i] && (f[i].t === 'n' || f[i].t === 'id' || f[i].t === '(')) v = v * unario();   // 2π, 3(4+1)
      else return v;
    }
  }
  function unario() { if (ve('-')) { i++; return -unario() } if (ve('+')) { i++; return unario() } return potencia() }
  function potencia() { const b = primario(); if (ve('^')) { i++; return Math.pow(b, unario()) } return b }
  function primario() {
    const k = f[i]; if (!k) throw new Error('expresión incompleta');
    if (k.t === 'n') { i++; return k.v }
    if (k.t === '(') { i++; const v = suma(); toma(')'); return v }
    if (k.t === 'id') {
      i++;
      if (k.v === 'π' || k.v === 'pi') return Math.PI;
      if (k.v === 'e') return Math.E;
      if (k.v === 'ans') return ans;
      if (k.v === '√') return Math.sqrt(potencia());
      if (FUNCIONES[k.v]) { toma('('); const v = suma(); toma(')'); return FUNCIONES[k.v](v) }
      throw new Error('función desconocida: ' + k.v);
    }
    throw new Error('expresión incompleta');
  }
  const v = suma();
  if (i < f.length) throw new Error(f[i].t === ')' ? 'sobra un paréntesis' : 'expresión no válida');
  if (!isFinite(v)) throw new Error('resultado no definido');
  return v;
}

/** Resultado con coma decimal y 6 cifras significativas. */
export const mostrar = v => String(+v.toPrecision(6)).replace('.', ',');
