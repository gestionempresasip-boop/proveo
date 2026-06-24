'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 3 estados simplificados. Los viejos (en_preparacion, listo, entregado)
// se mapean en la UI pero se intentan escribir como nuevos si la BD ya migró.
export type OrderStatus = 'pendiente' | 'hecho' | 'enviado' | 'cancelado'

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: current } = await sb.from('orders').select('status').eq('id', orderId).single()
  const wasAlreadyCancelled = current?.status === 'cancelado'

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

  // Al cancelar, devolver al stock de la nave lo que este pedido tenía reservado
  if (newStatus === 'cancelado' && !wasAlreadyCancelled) {
    const { data: items } = await sb.from('order_items').select('product_id, quantity, rectified_quantity').eq('order_id', orderId)
    await Promise.all(
      (items ?? []).map((it: any) =>
        sb.rpc('adjust_nave_stock', { p_product_id: it.product_id, p_delta: Number(it.rectified_quantity ?? it.quantity) })
      )
    )
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

  const items = order.order_items.map((item: any) => {
    const deliveredQty = item.rectified_quantity ?? item.quantity
    return {
      delivery_note_id: note.id,
      product_id: item.product_id,
      ordered_quantity: item.quantity,
      delivered_quantity: deliveredQty,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: deliveredQty * Number(item.unit_price),
    }
  })

  if (items.length > 0) await sb.from('delivery_note_items').insert(items)

  revalidatePath('/albaranes')
  revalidatePath('/pedidos')
  return note.id
}

// La nave rectifica la cantidad de una línea de pedido (ej: el restaurante
// pidió 5 pero solo quedan 3 en stock). Se guarda la cantidad pedida
// original (quantity) y la rectificada (rectified_quantity) por separado,
// para que tanto la nave como el restaurante vean ambas. Si ya existe un
// albarán generado para el pedido, se mantiene sincronizado.
export async function rectifyOrderItem(orderItemId: string, newQuantity: number, note?: string) {
  const supabase = await createClient()
  const sb = supabase as any

  const { data: item } = await sb.from('order_items').select('*').eq('id', orderItemId).single()
  if (!item) return

  const total_price = newQuantity * Number(item.unit_price)
  await sb.from('order_items')
    .update({ rectified_quantity: newQuantity, total_price, rectification_note: note || null })
    .eq('id', orderItemId)

  const { data: items } = await sb.from('order_items').select('quantity, rectified_quantity, unit_price').eq('order_id', item.order_id)
  const orderTotal = (items ?? []).reduce(
    (s: number, it: any) => s + Number(it.rectified_quantity ?? it.quantity) * Number(it.unit_price), 0
  )
  await sb.from('orders').update({ total_price: orderTotal }).eq('id', item.order_id)

  const { data: deliveryNote } = await sb.from('delivery_notes').select('id').eq('order_id', item.order_id).maybeSingle()
  if (deliveryNote) {
    await sb.from('delivery_note_items')
      .update({ delivered_quantity: newQuantity, total_price, note: note || null })
      .eq('delivery_note_id', deliveryNote.id)
      .eq('product_id', item.product_id)
  }

  revalidatePath('/pedidos')
  revalidatePath('/albaranes')
}

// Cancela por completo una línea del pedido (rotura de stock, producto en
// mal estado, etc.). El restaurante verá claramente que ese artículo no
// llegará, junto con el motivo si se indica.
export async function cancelOrderItem(orderItemId: string, reason?: string) {
  await rectifyOrderItem(orderItemId, 0, reason || 'Cancelado por la nave')
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
