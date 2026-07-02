'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { revalidatePath } from 'next/cache'

export type ClosurePeriodType = 'dia' | 'mes' | 'anual' | 'personalizado'

// Genera un cierre de inventario: una foto del stock actual (nave o
// restaurante) valorada al precio de coste de cada producto, etiquetada
// con el periodo que elija el usuario. No es un cálculo retroactivo — el
// stock guardado es el que hay en el momento de cerrar.
export async function createInventoryClosure(
  periodType: ClosurePeriodType,
  periodLabel: string,
  dateFrom: string,
  dateTo: string,
  isNave: boolean,
  organizationId: string,
) {
  const supabase = await createClient()
  const sb = supabase as any
  const profile = await getAuthProfile()

  const [{ data: products }, { data: inventoryRows }] = await Promise.all([
    sb.from('products')
      .select('id, name, unit, cost_price, product_categories!products_category_id_fkey(name)')
      .eq('is_active', true)
      .is('deleted_at', null),
    isNave
      ? sb.from('nave_inventory').select('product_id, current_stock')
      : sb.from('restaurant_inventory').select('product_id, current_stock').eq('organization_id', organizationId),
  ])

  const stockByProduct = new Map<string, number>(
    (inventoryRows ?? []).map((r: any) => [r.product_id, Number(r.current_stock) || 0])
  )

  const items = (products ?? []).map((p: any) => {
    const stock_qty = stockByProduct.get(p.id) ?? 0
    const cost_price = p.cost_price != null ? Number(p.cost_price) : null
    const line_value = stock_qty * (cost_price ?? 0)
    return {
      product_id: p.id,
      product_name: p.name,
      category_name: p.product_categories?.name ?? null,
      unit: p.unit,
      stock_qty,
      cost_price,
      line_value,
    }
  })

  const total_value = items.reduce((sum: number, i: typeof items[number]) => sum + i.line_value, 0)

  const { data: closure, error } = await sb.from('inventory_closures').insert({
    organization_id: organizationId,
    period_type: periodType,
    period_label: periodLabel,
    date_from: dateFrom,
    date_to: dateTo,
    total_items: items.length,
    total_value,
    created_by: profile.id,
  }).select().single()

  if (error) throw new Error(error.message)

  if (items.length > 0) {
    const { error: itemsError } = await sb.from('inventory_closure_items').insert(
      items.map((i: typeof items[number]) => ({ ...i, closure_id: closure.id }))
    )
    if (itemsError) throw new Error(itemsError.message)
  }

  revalidatePath('/inventario')
  return closure
}

export async function listInventoryClosures(organizationId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { data, error } = await sb
    .from('inventory_closures')
    .select('id, period_type, period_label, date_from, date_to, total_items, total_value, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

export async function getInventoryClosureItems(closureId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { data, error } = await sb
    .from('inventory_closure_items')
    .select('product_name, category_name, unit, stock_qty, cost_price, line_value')
    .eq('closure_id', closureId)
    .order('category_name')
    .order('product_name')
  if (error) return []
  return data ?? []
}

export async function deleteInventoryClosure(closureId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  const { error } = await sb.from('inventory_closures').delete().eq('id', closureId)
  if (error) throw new Error(error.message)
  revalidatePath('/inventario')
}
