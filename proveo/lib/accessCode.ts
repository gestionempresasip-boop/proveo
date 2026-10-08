import { createHash, timingSafeEqual } from 'crypto'

// Los códigos de acceso (Informes, Productos, Costes, Producción) viven en variables de entorno
// de Render y los teclea una persona en un móvil o una tablet. Se comparan SIN fijarse en
// espacios o saltos de línea sobrantes (muy fáciles de dejar al pegar en Render), comillas que se
// cuelan al pegar, ni mayúsculas (el teclado del móvil pone la primera en mayúscula).
export function normalizeCode(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').replace(/[\s"'`“”‘’]/g, '').toLowerCase()
}

const sha = (s: string) => createHash('sha256').update(s).digest()

/** ¿Coinciden el código tecleado y el configurado? Comparación de tiempo constante. */
export function codesMatch(typed: string, configured: string | null | undefined): boolean {
  const real = normalizeCode(configured)
  if (!real) return false
  return timingSafeEqual(sha(normalizeCode(typed)), sha(real))
}

/** Pista para los registros del servidor (nunca el código): si está o no y cuántos caracteres tiene. */
export const describeConfigured = (value: string | null | undefined) =>
  value ? `configurado (${normalizeCode(value).length} caracteres tras limpiarlo)` : 'NO configurado'

/**
 * Un código alfanumérico es solo letras y números, con al menos una letra y un número, y mínimo
 * 8 caracteres. Devuelve el motivo si el código configurado no lo cumple, o null si es válido.
 */
export function alphanumericProblem(value: string | null | undefined): string | null {
  const c = normalizeCode(value)
  if (!c) return null
  if (!/^[a-z0-9]+$/.test(c)) return 'solo puede llevar letras y números, sin símbolos'
  if (!/[a-z]/.test(c) || !/\d/.test(c)) return 'tiene que llevar letras y números a la vez'
  if (c.length < 8) return 'tiene que tener al menos 8 caracteres'
  return null
}
