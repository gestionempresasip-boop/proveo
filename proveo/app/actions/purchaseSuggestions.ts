'use server'

import { createClient } from '@/lib/supabase/server'

// Cuánto se consume de media al día por producto (últimos 30 días de
// pedidos reales, sin contar cancelados) frente a lo que queda en stock,
// para saber qué reponer antes de quedarse corto — no solo "está por
// debajo del mínimo" sino "a este ritmo, cuántos días te quedan".
const LOOKBACK_DAYS = 30
const TARGET_COVERAGE_DAYS = 14

export type PurchaseSuggestion = {
  productId: string
  productName: string
  unit: string
  avgDailyConsumption: number
  currentStock: number
  minStock: number
  daysOfCoverage: number | null
  suggestedQty: number
}

export async function getPurchaseSuggestions(): Promise<PurchaseSuggestion[]> {
  const supabase = await createClient()
  const sb = supabase as any

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString()

  const [{ data: orders }, { data: inventory }] = await Promise.all([
    sb.from('orders')
      .select('created_at, status, order_items(product_id, quantity, rectified_quantity)')
      .gte('created_at', since)
      .neq('status', 'cancelado'),
    sb.from('nave_inventory').select('product_id, current_stock, min_stock, products(name, unit, is_active)'),
  ])

  const consumptionByProduct: Record<string, number> = {}
  ;(orders ?? []).forEach((o: any) => {
    (o.order_items ?? []).forEach((it: any) => {
      const qty = Number(it.rectified_quantity ?? it.quantity)
      consumptionByProduct[it.product_id] = (consumptionByProduct[it.product_id] ?? 0) + qty
    })
  })

  const suggestions: PurchaseSuggestion[] = (inventory ?? [])
    .filter((inv: any) => inv.products?.is_active)
    .map((inv: any) => {
      const totalConsumed = consumptionByProduct[inv.product_id] ?? 0
      const avgDaily = totalConsumed / LOOKBACK_DAYS
      const currentStock = Number(inv.current_stock)
      const daysOfCoverage = avgDaily > 0 ? currentStock / avgDaily : null
      const suggestedQty = avgDaily > 0 ? Math.max(0, Math.ceil(avgDaily * TARGET_COVERAGE_DAYS - currentStock)) : 0
      return {
        productId: inv.product_id,
        productName: inv.products?.name ?? 'Producto',
        unit: inv.products?.unit ?? '',
        avgDailyConsumption: avgDaily,
        currentStock,
        minStock: Number(inv.min_stock),
        daysOfCoverage,
        suggestedQty,
      }
    })
    .filter((s: PurchaseSuggestion) => s.avgDailyConsumption > 0)
    .sort((a: PurchaseSuggestion, b: PurchaseSuggestion) => (a.daysOfCoverage ?? Infinity) - (b.daysOfCoverage ?? Infinity))

  return suggestions
}
