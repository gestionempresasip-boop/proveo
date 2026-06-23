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
] as const

export const UNITS = UNIT_OPTIONS.map(u => u.value)

export const UNIT_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_OPTIONS.map(u => [u.value, u.label])
)

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit
}
