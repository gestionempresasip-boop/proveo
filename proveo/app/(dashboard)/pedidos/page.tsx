import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Package } from 'lucide-react'
import { PedidosNaveClient } from '@/components/orders/PedidosNaveClient'
import { PedidosRestauranteClient } from '@/components/orders/PedidosRestauranteClient'
import { requireArea } from '@/lib/areaGuard'
import { canSeePrices } from '@/lib/areas'

export default async function PedidosPage() {
  await requireArea('pedidos')
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  // ── Nave: fetch all orders + restaurants ─────────────────────────────────
  if (isNave) {
    const naveSelect = '*, organizations(id, name), order_items(*, products(name, unit)), delivery_notes(id, note_number, type, delivery_note_items(product_id, delivered_quantity, return_reason, products(name))), deleted_by_profile:profiles!deleted_by(full_name)'
    const [{ data: orders }, { data: deletedOrders }, { data: restaurants }] = await Promise.all([
      sb
        .from('orders')
        .select(naveSelect)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
      // Papelera: pedidos eliminados (borrado suave), para poder verlos y
      // restaurarlos si fue un error. Últimos 90 días, no hace falta más.
      sb
        .from('orders')
        .select(naveSelect)
        .not('deleted_at', 'is', null)
        .gte('deleted_at', new Date(Date.now() - 90 * 86400000).toISOString())
        .order('deleted_at', { ascending: false })
        .limit(100),
      sb
        .from('organizations')
        .select('id, name')
        .eq('type', 'restaurante')
        .order('name'),
    ])

    // Sin permiso de precios (Reparto) los importes NO salen del servidor, no solo se esconden.
    const showPrices = canSeePrices(profile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strip = (list: any[]) => showPrices ? list : list.map(o => ({
      ...o, total_price: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      order_items: (o.order_items ?? []).map((i: any) => ({ ...i, unit_price: 0, total_price: 0 })),
    }))

    return (
      <PedidosNaveClient
        showPrices={showPrices}
        orders={strip(orders ?? [])}
        deletedOrders={strip(deletedOrders ?? [])}
        restaurants={restaurants ?? []}
        currentUserId={profile.id}
      />
    )
  }

  // ── Restaurante: vista simple de historial ───────────────────────────────
  const restSelect = '*, order_items(*, products(name, unit)), delivery_notes(id, type, delivery_note_items(product_id, delivered_quantity, return_reason)), deleted_by_profile:profiles!deleted_by(full_name)'
  const [{ data: orders }, { data: deletedOrders }] = await Promise.all([
    sb
      .from('orders')
      .select(restSelect)
      .eq('restaurant_id', profile.organization_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    sb
      .from('orders')
      .select(restSelect)
      .eq('restaurant_id', profile.organization_id)
      .not('deleted_at', 'is', null)
      .gte('deleted_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('deleted_at', { ascending: false })
      .limit(100),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-black">Mis pedidos</h1>
        <p className="text-gray-700 mt-1 text-sm">Historial de tus pedidos enviados a la nave</p>
      </div>

      <PedidosRestauranteClient orders={orders ?? []} deletedOrders={deletedOrders ?? []} currentUserId={profile.id} />
    </div>
  )
}
