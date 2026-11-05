// Margen (fracción: 0,25 = 25 %) de una fila del registro de cambios.
// Si la fila lo trae guardado se usa; en los cambios antiguos (anteriores a registrar el margen)
// se calcula a partir del coste y del precio de esa fecha: precio ÷ coste − 1.
export function marginOfLog(stored: unknown, cost: number | null, price: number | null): number | null {
  if (stored != null && Number.isFinite(Number(stored))) return Number(stored)
  return cost != null && cost > 0 && price != null && price > 0 ? price / cost - 1 : null
}
