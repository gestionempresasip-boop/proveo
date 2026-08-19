'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { checkAndNotifyLowStock } from '@/lib/notifications/lowStock'

// Aplica un recuento físico: para cada producto contado, ajusta el stock a
// la cantidad real contada (vía adjust_nave_stock, para que quede en el
// historial de movimientos con motivo 'recuento' y no como "ajuste_manual"
// genérico). Se relee el stock actual justo antes de aplicar — si alguien
// más lo cambió entre que se abrió el recuento y se confirmó (un pedido,
// por ejemplo), el delta se calcula sobre el valor real más reciente, no
// sobre uno ya desfasado.
export async function applyStockCount(entries: { productId: string; countedQty: number }[]) {
  if (entries.length === 0) return { applied: 0 }
  const supabase = await createClient()
  const sb = supabase as any

  const ids = entries.map(e => e.productId)
  const { data: current } = await sb.from('nave_inventory').select('product_id, current_stock').in('product_id', ids)
  const currentById = new Map<string, number>((current ?? []).map((r: any) => [r.product_id, Number(r.current_stock)]))

  const toApply = entries
    .map(e => ({ productId: e.productId, delta: e.countedQty - (currentById.get(e.productId) ?? 0) }))
    .filter(e => e.delta !== 0)

  await Promise.all(
    toApply.map(e => sb.rpc('adjust_nave_stock', { p_product_id: e.productId, p_delta: e.delta, p_reason: 'recuento' }))
  )

  const decreased = toApply.filter(e => e.delta < 0).map(e => e.productId)
  if (decreased.length > 0) checkAndNotifyLowStock(decreased).catch(() => {})

  revalidatePath('/inventario')
  return { applied: toApply.length }
}
