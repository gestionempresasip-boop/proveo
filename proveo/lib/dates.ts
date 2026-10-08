// Día natural en hora de España (yyyy-mm-dd). El servidor corre en UTC: «hoy» no puede
// salir de `new Date().setHours(0,0,0,0)`, que cortaría el día a las 01:00 o 02:00.
export const madridDay = (d: Date | string | number): string =>
  new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
