import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeRates, DEFAULT_SETTINGS, looksLikeProduction,
  type CostSettings, type NaveCostItem, type Rates,
} from '@/lib/realCost'
import { rowsOf } from '@/lib/serverAccess'

// Datos de la nave que necesita el cálculo de costes reales. La pantalla de Costes y
// «Aplicar al producto» (servidor) usan ESTA misma carga, para que den el mismo coste.

type FixedRow = { id: string; category: string; name: string; monthly_amount: number | string; active: boolean }
type ExtraRow = { name: string; value: number | string; active: boolean }

export type CostContext = {
  items: NaveCostItem[]
  extraItems: { name: string; value: number }[]
  settings: CostSettings
  settingsSaved: boolean
  rates: Rates
}

export async function loadCostContext(db: SupabaseClient, orgId: string): Promise<CostContext> {
  const [fixed, extra, settingsRes] = await Promise.all([
    db.from('nave_fixed_costs').select('id, category, name, monthly_amount, active').order('category').order('name'),
    db.from('org_cost_items').select('name, value, active').eq('organization_id', orgId).eq('mode', 'monthly'),
    db.from('nave_cost_settings').select('*').eq('organization_id', orgId).maybeSingle(),
  ])
  const items: NaveCostItem[] = rowsOf<FixedRow>(fixed).map(i => ({ ...i, monthly_amount: Number(i.monthly_amount) }))
  const extraItems = rowsOf<ExtraRow>(extra).filter(i => i.active).map(i => ({ name: i.name, value: Number(i.value) }))

  const saved = settingsRes.data as (Partial<CostSettings> & { labor_item_ids?: string[] }) | null
  // Sin ajustes guardados: se marcan los cocineros, pasteleros y ayudantes de cocina.
  const settings: CostSettings = saved
    ? { ...DEFAULT_SETTINGS, ...saved, labor_item_ids: saved.labor_item_ids ?? [] }
    : { ...DEFAULT_SETTINGS, labor_item_ids: items.filter(looksLikeProduction).map(i => i.id) }

  const extraMonthly = extraItems.reduce((a, i) => a + i.value, 0)
  return { items, extraItems, settings, settingsSaved: !!saved, rates: computeRates(items, extraMonthly, settings) }
}

type OrderItemRow = { product_id: string; quantity: number | string; rectified_quantity: number | string | null }
type OrderRow = { created_at: string; order_items: OrderItemRow[] | null }

const PAGE = 1000 // Supabase devuelve como máximo 1.000 filas por consulta

/** Unidades vendidas al mes por producto: media del periodo con pedidos (pagina para no cortarse a 1.000 pedidos). */
export async function loadSoldPerMonth(db: SupabaseClient): Promise<Record<string, number>> {
  const orders: OrderRow[] = []
  for (let from = 0; ; from += PAGE) {
    const res = await db.from('orders')
      .select('created_at, order_items(product_id, quantity, rectified_quantity)')
      .neq('status', 'cancelado').is('deleted_at', null)
      .order('created_at').range(from, from + PAGE - 1)
    const page = rowsOf<OrderRow>(res)
    orders.push(...page)
    if (page.length < PAGE) break
  }
  if (orders.length === 0) return {}
  const spanMonths = Math.max((Date.now() - new Date(orders[0].created_at).getTime()) / 86400000 / 30.4, 0.5)
  const totals: Record<string, number> = {}
  for (const o of orders) {
    for (const it of o.order_items ?? []) totals[it.product_id] = (totals[it.product_id] ?? 0) + Number(it.rectified_quantity ?? it.quantity)
  }
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / spanMonths]))
}
