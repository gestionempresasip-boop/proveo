// Unidades disponibles para productos. El "value" es lo que se guarda en BD.
export const UNIT_OPTIONS = [
  { value: 'kg',           label: 'kg' },
  { value: 'g',            label: 'g' },
  { value: 'l',            label: 'lt' },
  { value: 'ml',           label: 'ml' },
  { value: 'unidad',       label: 'unidad' },
  { value: 'caja',         label: 'caja' },
  { value: 'bandeja',      label: 'bandeja' },
  { value: 'bolsa_500g',   label: 'bolsa 1/2 kg' },
  { value: 'bolsa_1kg',    label: 'bolsa 1 kg' },
  { value: 'barqueta_2kg', label: 'barqueta 2 kg' },
  { value: 'barqueta_4kg', label: 'barqueta 4 kg' },
  { value: 'racion',       label: 'ración' },
  { value: 'bolsa',        label: 'bolsa' },
  { value: 'paquete',      label: 'paquete' },
] as const

export const UNITS = UNIT_OPTIONS.map(u => u.value)

export const UNIT_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_OPTIONS.map(u => [u.value, u.label])
)

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit
}

// ── Conversión a kg / litros ────────────────────────────────────────────────
// Solo tiene sentido para unidades con un peso/volumen fijo conocido.
// El resto (unidad, caja, bandeja, ración) no tienen equivalencia fija.
const KG_PER_UNIT: Record<string, number> = {
  kg: 1, g: 0.001,
  bolsa_500g: 0.5, bolsa_1kg: 1,
  barqueta_2kg: 2, barqueta_4kg: 4,
}
const LT_PER_UNIT: Record<string, number> = {
  l: 1, ml: 0.001,
}

/** Cantidad pedida (nº de bolsas/barquetas/kg/etc.) → equivalente real en kg, o null si la unidad no es convertible. */
export function toKg(unit: string, quantity: number): number | null {
  const factor = KG_PER_UNIT[unit]
  return factor != null ? quantity * factor : null
}

/** Cantidad pedida → equivalente real en litros, o null si la unidad no es de volumen. */
export function toLitros(unit: string, quantity: number): number | null {
  const factor = LT_PER_UNIT[unit]
  return factor != null ? quantity * factor : null
}

/** Texto corto "(= 8 kg)" para mostrar junto a la cantidad pedida. Vacío si no aplica o es trivial (ya está en kg/lt). */
export function realQuantityLabel(unit: string, quantity: number): string {
  if (unit === 'kg' || unit === 'l') return ''
  const kg = toKg(unit, quantity)
  if (kg != null) return `(= ${kg % 1 === 0 ? kg : kg.toFixed(2)} kg)`
  const lt = toLitros(unit, quantity)
  if (lt != null) return `(= ${lt % 1 === 0 ? lt : lt.toFixed(2)} lt)`
  return ''
}

// Unidades con conversión fija a kg o litros, para el conversor manual
export const CONVERTIBLE_UNITS = UNIT_OPTIONS.filter(
  u => KG_PER_UNIT[u.value] != null || LT_PER_UNIT[u.value] != null
)
