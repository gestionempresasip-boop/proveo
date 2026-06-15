'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type OrderStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
  const supabase = await createClient()
  const sb = supabase as any

  const { error } = await sb
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) throw new Error(error.message)

  // Si se marca como entregado, generar albarán automáticamente
  if (newStatus === 'entregado') {
    await createDeliveryNote(orderId)
  }

  revalidatePath('/pedidos')
  revalidatePath('/albaranes')
}

async function createDeliveryNote(orderId: string) {
  const supabase = await createClient()
  const sb = supabase as any

  // Verificar que no existe ya un albarán para este pedido
  const { data: existing } = await sb
    .from('delivery_notes')
    .select('id')
    .eq('order_id', orderId)
    .single()

  if (existing) return

  // Obtener datos del pedido con sus líneas
  const { data: order } = await sb
    .from('orders')
    .select('*, order_items(*, products(name, price, unit))')
    .eq('id', orderId)
    .single()

  if (!order) return

  // Crear albarán
  const { data: note, error } = await sb
    .from('delivery_notes')
    .insert({
      order_id: orderId,
      delivered_at: new Date().toISOString(),
      notes: null,
    })
    .select()
    .single()

  if (error || !note) return

  // Crear líneas del albarán
  const items = order.order_items.map((item: any) => ({
    delivery_note_id: note.id,
    product_id: item.product_id,
    ordered_quantity: item.quantity,
    delivered_quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: item.total_price,
  }))

  if (items.length > 0) {
    await sb.from('delivery_note_items').insert(items)
  }
}
