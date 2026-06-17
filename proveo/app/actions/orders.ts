'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 3 estados simplificados. Los viejos (en_preparacion, listo, entregado)
// se mapean en la UI pero se intentan escribir como nuevos si la BD ya migró.
export type OrderStatus = 'pendiente' | 'hecho' | 'enviado' | 'cancelado'

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const supabase = await createClient()
  const sb = supabase as any

  const { error } = await sb
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) {
    // Si falla (constraint antigua), intentar con mapeado legacy
    const legacy: Record<string, string> = { hecho: 'en_preparacion', enviado: 'entregado' }
    if (legacy[newStatus]) {
      await sb.from('orders').update({ status: legacy[newStatus], updated_at: new Date().toISOString() }).eq('id', orderId)
    }
  }

  if (newStatus === 'enviado') {
    await generateDeliveryNote(orderId)
  }

  revalidatePath('/pedidos')
  revalidatePath('/albaranes')
}

export async function generateDeliveryNote(orderId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: existing } = await sb.from('delivery_notes').select('id').eq('order_id', orderId).maybeSingle()
  if (existing) return existing.id

  const { data: order } = await sb
    .from('orders')
    .select('*, order_items(*, products(name, price, unit))')
    .eq('id', orderId)
    .single()

  if (!order) return null

  const { data: note, error } = await sb
    .from('delivery_notes')
    .insert({ order_id: orderId, delivered_at: new Date().toISOString() })
    .select()
    .single()

  if (error || !note) return null

  const items = order.order_items.map((item: any) => ({
    delivery_note_id: note.id,
    product_id: item.product_id,
    ordered_quantity: item.quantity,
    delivered_quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: item.total_price,
  }))

  if (items.length > 0) await sb.from('delivery_note_items').insert(items)

  revalidatePath('/albaranes')
  return note.id
}

export async function deleteOrder(orderId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  // Remove linked delivery notes first
  const { data: notes } = await sb.from('delivery_notes').select('id').eq('order_id', orderId)
  if (notes?.length) {
    await sb.from('delivery_note_items').delete().in('delivery_note_id', notes.map((n: any) => n.id))
    await sb.from('delivery_notes').delete().eq('order_id', orderId)
  }
  await sb.from('order_items').delete().eq('order_id', orderId)
  await sb.from('orders').delete().eq('id', orderId)

  revalidatePath('/pedidos')
  revalidatePath('/albaranes')
}

export async function deleteDeliveryNote(noteId: string) {
  const supabase = await createClient()
  const sb = supabase as any
  await sb.from('delivery_note_items').delete().eq('delivery_note_id', noteId)
  await sb.from('delivery_notes').delete().eq('id', noteId)
  revalidatePath('/albaranes')
}
