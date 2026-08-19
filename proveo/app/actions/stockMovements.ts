'use server'

import { createClient } from '@/lib/supabase/server'

export type StockMovement = {
  id: string
  product_id: string | null
  product_name: string
  delta: number
  resulting_stock: number | null
  reason: string
  order_number: number | null
  notes: string | null
  created_by_name: string | null
  created_at: string
}

const REASON_LABEL: Record<string, string> = {
  entrada_manual: 'Entrada manual',
  compra: 'Compra',
  produccion: 'Producción',
  consumo: 'Consumo',
  venta: 'Pedido / venta',
  merma: 'Merma',
}

// stock_movements es una tabla que ya existía antes de este módulo (de un
// "Almacén" retirado hace tiempo, ver git log — nunca se borró). Se
// reutiliza tal cual con sus columnas reales, en vez de crear una tabla
// paralela: item_name/movement_type/quantity/stock_after/reference_id, no
// delta/reason/resulting_stock/reference_order_id.
export async function getStockMovements(opts: {
  dateFrom?: string; dateTo?: string; productId?: string; reason?: string
}) {
  const supabase = await createClient()
  const sb = supabase as any

  let query = sb
    .from('stock_movements')
    .select('id, product_id, item_name, movement_type, quantity, stock_after, reference_type, reference_id, notes, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (opts.dateFrom) query = query.gte('created_at', opts.dateFrom)
  if (opts.dateTo) {
    const end = new Date(opts.dateTo)
    end.setDate(end.getDate() + 1)
    query = query.lt('created_at', end.toISOString())
  }
  if (opts.productId) query = query.eq('product_id', opts.productId)
  if (opts.reason) query = query.eq('movement_type', opts.reason)

  const { data, error } = await query
  if (error || !data) return []

  // reference_id no tiene FK a orders (puede apuntar a cosas distintas
  // según reference_type), así que no se puede pedir con un join anidado —
  // se resuelven los números de pedido aparte, en una sola consulta.
  const orderIds = [...new Set(data.filter((m: any) => m.reference_type === 'order' && m.reference_id).map((m: any) => m.reference_id))]
  let orderNumberById = new Map<string, number>()
  if (orderIds.length > 0) {
    const { data: orders } = await sb.from('orders').select('id, order_number').in('id', orderIds)
    orderNumberById = new Map((orders ?? []).map((o: any) => [o.id, o.order_number]))
  }

  return data.map((m: any): StockMovement => ({
    id: m.id,
    product_id: m.product_id,
    product_name: m.item_name,
    delta: Number(m.quantity),
    resulting_stock: m.stock_after != null ? Number(m.stock_after) : null,
    reason: REASON_LABEL[m.movement_type] ?? m.movement_type,
    order_number: m.reference_id ? orderNumberById.get(m.reference_id) ?? null : null,
    notes: m.notes,
    created_by_name: m.profiles?.full_name ?? null,
    created_at: m.created_at,
  }))
}
