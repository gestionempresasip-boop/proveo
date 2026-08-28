import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { LicinioClient } from '@/components/stats/LicinioClient'
import { LicinioGate } from '@/components/stats/LicinioGate'
import { isLicinioUnlocked } from '@/app/actions/licinioGate'
import { redirect } from 'next/navigation'

export default async function LicinioPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  if (profile.organizations.type !== 'nave') redirect('/dashboard')

  if (!(await isLicinioUnlocked())) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <LicinioGate />
      </div>
    )
  }

  const sb = supabase as any

  const [{ data: orders }, { data: restaurants }] = await Promise.all([
    sb
      .from('orders')
      .select(`
        id, order_number, created_at, total_price, restaurant_id, status,
        organizations!restaurant_id(id, name),
        order_items(id, product_id, quantity, rectified_quantity, unit, unit_price, total_price,
          products(name, unit)
        )
      `)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false }),
    sb
      .from('organizations')
      .select('id, name')
      .eq('type', 'restaurante')
      .order('name'),
  ])

  type Line = {
    order_id: string; order_number: number; created_at: string
    restaurant_id: string; restaurant_name: string
    product_id: string; product_name: string
    quantity: number; unit: string; item_total: number
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
        // Misma cantidad "real" que usa Informes: la rectificada si la hay,
        // no la aproximada del pedido original.
        quantity: Number(item.rectified_quantity ?? item.quantity),
        unit: item.unit,
        item_total: Number(item.total_price),
      })
    }
  }

  return (
    <LicinioClient lines={lines} restaurants={restaurants ?? []} />
  )
}
