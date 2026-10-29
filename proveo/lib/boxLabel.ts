// Nombre del envase cuando un producto se pide "por caja": la nave elige "caja" o "bolsa" en cada producto
// (por defecto caja). El mecanismo es el mismo: unidades aproximadas por envase que la nave corrige al preparar.
export type BoxLabel = 'caja' | 'bolsa'

export function boxWordOf(p?: { box_label?: string | null } | null): BoxLabel {
  return p?.box_label === 'bolsa' ? 'bolsa' : 'caja'
}

export function boxPlural(word: BoxLabel, n: number): string {
  return n === 1 ? word : `${word}s`
}
