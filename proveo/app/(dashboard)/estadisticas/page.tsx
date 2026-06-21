import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { EstadisticasClient } from '@/components/stats/EstadisticasClient'
import { redirect } from 'next/navigation'

export default async function EstadisticasPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') redirect('/dashboard')
  const sb = supabase as any

  // Traer todos los pedidos con sus líneas y restaurante
  // Excluimos cancelados
  const { data: orders } = await sb
    .from('orders')
    .select(`
      id, order_number, created_at, total_price, restaurant_id, status,
      organizations!restaurant_id(id, name),
      order_items(id, product_id, quantity, unit, unit_price, total_price,
        products(name)
      )
    `)
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false })

  // Aplanar a filas por línea de pedido (para cálculos granulares)
  type Line = {
    order_id: string; order_number: number; created_at: string
    restaurant_id: string; restaurant_name: string
    product_id: string; product_name: string
    quantity: number; unit: string; unit_price: number
    item_total: number; order_total: number
  }

  const lines: Line[] = []
  for (const o of orders ?? []) {
    for (const item of o.order_items ?? []) {
      lines.push({
        order_id: o.id,
        order_number: o.order_number,
        created_at: o.created_at,
        restaurant_id: o.restaurant_id,
        restaurant_name: (o.organizations as any)?.name ?? 'Desconocido',
        product_id: item.product_id,
        product_name: (item.products as any)?.name ?? 'Producto eliminado',
        quantity: Number(item.quantity),
        unit: item.unit,
        unit_price: Number(item.unit_price),
        item_total: Number(item.total_price),
        order_total: Number(o.total_price),
      })
    }
  }

  // Lista de restaurantes para el filtro
  const { data: restaurants } = await sb
    .from('organizations')
    .select('id, name')
    .eq('type', 'restaurante')
    .order('name')

  return (
    <EstadisticasClient
      lines={lines}
      restaurants={restaurants ?? []}
    />
  )
}
