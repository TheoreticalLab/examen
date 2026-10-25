// CONFIGURACIÓN DEL PROFESOR
export const CONFIG = {
  profesor: 'Francisco Orbe',
  asignatura: 'Física General',
  // URL /exec del Apps Script (google/Examen.gs). Vacía = MODO DEMOSTRACIÓN: todo ocurre en el móvil, el código de examen
  // es el de `demo` y las claves salen del generador de docente.html. Solo para probar: un estudiante con conocimientos
  // podría calcular las claves. En modo real las claves, la hora de inicio y la corrección las lleva el servidor.
  urlServidor: '',
  demo: { codigo: 'DEMO', secreto: 'demo-fisica-general', titulo: 'Examen de demostración', duracionMin: 20, nProblemas: 5, tolerancia: 2, mostrarNota: true }
};
