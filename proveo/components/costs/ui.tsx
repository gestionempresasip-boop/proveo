import { cn } from '@/lib/utils'
import type { CostSheet, Extra, Ingredient } from '@/lib/realCost'

export type Product = { id: string; name: string; unit: string; price: number; cost_price: number; margin: number; iva_rate: number; is_active: boolean }
export type SavedSheet = CostSheet & { id: string }

export const emptySheet = (): CostSheet => ({
  product_id: null, name: '', yield_qty: 1, people: 1, minutes: 0, ingredients: [], extras: [], markup_pct: 30, notes: null,
})
export const emptyIngredient = (): Ingredient => ({ name: '', product_id: null, quantity: 0, unit: 'kg', unit_price: 0, waste_pct: 0 })
export const QUICK_EXTRAS = ['Bolsa de envasado', 'Etiqueta', 'Caja / bandeja', 'Transporte', 'Almacenamiento (frío)', 'Otros indirectos']
export type { Extra }

export const field = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]'
export const label = 'text-xs font-semibold text-gray-700 uppercase tracking-wide'

export function Stat({ title, value, hint, strong }: { title: string; value: string; hint: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3.5', strong ? 'bg-[#1E2B28] border-[#1E2B28] text-white' : 'bg-gray-50 border-gray-100')}>
      <p className={cn('text-[11px] uppercase font-semibold tracking-wide', strong ? 'text-white/70' : 'text-gray-500')}>{title}</p>
      <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
      <p className={cn('text-[11px] mt-0.5', strong ? 'text-white/70' : 'text-gray-500')}>{hint}</p>
    </div>
  )
}
