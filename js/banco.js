// BANCO DE PROBLEMAS · plantillas con datos aleatorios. Cada estudiante recibe otros números y otro orden, así que
// copiar el resultado del compañero no sirve. Para añadir un problema: una entrada más en PLANTILLAS con
//   id (único y estable: forma parte de la semilla), tema, y generar(az) → { enunciado, tipo: 'num' | 'opcion', ... }
//   · 'num':    unidad, respuesta (número) y, si se quiere, tolerancia relativa (por defecto 2 %)
//   · 'opcion': opciones (textos) y correcta (índice); el orden de las opciones se mezcla por estudiante
// Sin acceso al navegador: este archivo también se copia en el Apps Script del profesor, que corrige las entregas.

export const G = 9.8;

/** Número con coma decimal y como mucho `d` decimales, sin ceros sobrantes (12,5 · 0,35 · 4). */
export function num(x, d = 2) {
  const f = Math.pow(10, d), r = Math.round(x * f) / f;
  return String(r).replace('.', ',');
}

export const PLANTILLAS = [
  {
    id: 'lanzamiento', tema: 'Cinemática',
    generar(az) {
      const h = az.entero(8, 45), v = az.entero(4, 16);
      return {
        tipo: 'num', unidad: 'm', respuesta: v * Math.sqrt(2 * h / G),
        enunciado: `Desde la azotea de un edificio de ${h} m de altura se lanza una pelota horizontalmente con una rapidez de ${v} m/s. ¿A qué distancia horizontal de la base del edificio llega al suelo? Desprecia la resistencia del aire (g = 9,8 m/s²).`
      };
    }
  },
  {
    id: 'plano', tema: 'Dinámica',
    generar(az) {
      const m = az.entero(2, 12), th = az.entero(25, 45), mu = az.paso(0.10, 0.30, 0.05), rad = th * Math.PI / 180;
      return {
        tipo: 'num', unidad: 'm/s²', respuesta: G * (Math.sin(rad) - mu * Math.cos(rad)),
        enunciado: `Un bloque de ${m} kg se suelta sobre un plano inclinado ${th}° respecto a la horizontal. El coeficiente de rozamiento cinético entre el bloque y el plano es μₖ = ${num(mu)}. ¿Cuál es la aceleración del bloque mientras baja? (g = 9,8 m/s²)`
      };
    }
  },
  {
    id: 'resorte', tema: 'Energía',
    generar(az) {
      const k = az.paso(150, 600, 50), x = az.paso(0.05, 0.20, 0.01), m = az.paso(0.5, 3, 0.5);
      return {
        tipo: 'num', unidad: 'm/s', respuesta: x * Math.sqrt(k / m),
        enunciado: `Un resorte de constante k = ${k} N/m está comprimido ${num(x * 100, 0)} cm contra un bloque de ${num(m, 1)} kg, sobre una superficie horizontal sin rozamiento. Se suelta el sistema. ¿Con qué rapidez sale despedido el bloque cuando el resorte recupera su longitud natural?`
      };
    }
  },
  {
    id: 'periodo', tema: 'Oscilaciones',
    generar(az) {
      const m = az.paso(0.2, 2, 0.1), k = az.paso(20, 200, 10);
      return {
        tipo: 'num', unidad: 's', respuesta: 2 * Math.PI * Math.sqrt(m / k),
        enunciado: `Un bloque de ${num(m, 1)} kg unido a un resorte de constante ${k} N/m oscila sobre una mesa horizontal sin rozamiento. ¿Cuál es el período de la oscilación?`
      };
    }
  },
  {
    id: 'choque', tema: 'Momento lineal',
    generar(az) {
      const m1 = az.entero(1, 6), v1 = az.entero(2, 12), m2 = az.entero(1, 6);
      return {
        tipo: 'num', unidad: 'm/s', respuesta: m1 * v1 / (m1 + m2),
        enunciado: `Un carrito de ${m1} kg que se mueve a ${v1} m/s choca contra otro carrito de ${m2} kg que está en reposo. Tras el choque quedan enganchados y se mueven juntos. ¿Con qué rapidez se mueven después del choque?`
      };
    }
  },
  {
    id: 'curva', tema: 'Movimiento circular',
    generar(az) {
      const R = az.paso(30, 150, 5), mu = az.paso(0.30, 0.90, 0.05);
      return {
        tipo: 'num', unidad: 'm/s', respuesta: Math.sqrt(mu * G * R),
        enunciado: `Un coche toma una curva plana (sin peralte) de ${R} m de radio. El coeficiente de rozamiento estático entre las ruedas y el asfalto es μₛ = ${num(mu)}. ¿Cuál es la rapidez máxima con la que puede tomar la curva sin derrapar? (g = 9,8 m/s²)`
      };
    }
  },
  {
    id: 'periodo-masa', tema: 'Oscilaciones',
    generar(az) {
      const T = az.paso(0.8, 2.4, 0.1), f = az.elegir([4, 9]), r = Math.sqrt(f);
      return {
        tipo: 'opcion',
        enunciado: `Un sistema masa-resorte oscila con un período de ${num(T, 1)} s. Si la masa se multiplica por ${f} y se usa el mismo resorte, ¿cuál es el nuevo período?`,
        opciones: [`${num(T * r)} s`, `${num(T * f)} s`, `${num(T / r)} s`, `${num(T, 1)} s (no cambia)`], correcta: 0
      };
    }
  },
  {
    id: 'plano-masa', tema: 'Dinámica',
    generar(az) {
      const th = az.entero(20, 50), m = az.entero(2, 8);
      return {
        tipo: 'opcion',
        enunciado: `Un bloque de ${m} kg baja por un plano inclinado ${th}° sin rozamiento. Si se repite el experimento con un bloque de ${2 * m} kg (el doble de masa), su aceleración:`,
        opciones: ['no cambia', 'se duplica', 'se reduce a la mitad', 'se cuadruplica'], correcta: 0
      };
    }
  }
];
