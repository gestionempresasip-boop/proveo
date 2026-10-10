import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Package } from 'lucide-react'
import { PedidosNaveClient } from '@/components/orders/PedidosNaveClient'
import { NAVE_ORDER_SELECT, RECENT_HOURS, TRASH_DAYS } from '@/lib/ordersQuery'
import { PedidosRestauranteClient } from '@/components/orders/PedidosRestauranteClient'

export default async function PedidosPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  // ── Nave: fetch all orders + restaurants ─────────────────────────────────
  if (isNave) {
    const recentFrom = new Date(Date.now() - RECENT_HOURS * 3600000).toISOString()
    // Al entrar solo hace falta lo de hoy y lo pendiente; semana/mes/rango y la papelera se piden al usarlos.
    const [{ data: orders }, { count: trashCount }, { data: restaurants }] = await Promise.all([
      sb
        .from('orders')
        .select(NAVE_ORDER_SELECT)
        .is('deleted_at', null)
        .or(`status.eq.pendiente,created_at.gte.${recentFrom}`)
        .order('created_at', { ascending: false })
        .limit(500),
      // Papelera: pedidos eliminados (borrado suave), para poder verlos y
      // restaurarlos si fue un error. Últimos 90 días, no hace falta más.
      sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)
        .gte('deleted_at', new Date(Date.now() - TRASH_DAYS * 86400000).toISOString()),
      sb
        .from('organizations')
        .select('id, name')
        .eq('type', 'restaurante')
        .order('name'),
    ])

    return (
      <PedidosNaveClient
        orders={orders ?? []}
        trashCount={trashCount ?? 0}
        loadedFrom={recentFrom}
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
