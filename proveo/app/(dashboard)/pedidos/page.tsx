import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Package } from 'lucide-react'
import { PedidosNaveClient } from '@/components/orders/PedidosNaveClient'
import { PedidosRestauranteClient } from '@/components/orders/PedidosRestauranteClient'

export default async function PedidosPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()
  const isNave = profile.organizations.type === 'nave'
  const sb = supabase as any

  // ── Nave: fetch all orders + restaurants ─────────────────────────────────
  if (isNave) {
    const [{ data: orders }, { data: restaurants }] = await Promise.all([
      sb
        .from('orders')
        .select('*, organizations(id, name), order_items(*, products(name, unit)), delivery_notes(id, note_number)')
        .order('created_at', { ascending: false }),
      sb
        .from('organizations')
        .select('id, name')
        .eq('type', 'restaurante')
        .order('name'),
    ])

    return (
      <PedidosNaveClient
        orders={orders ?? []}
        restaurants={restaurants ?? []}
      />
    )
  }

  // ── Restaurante: vista simple de historial ───────────────────────────────
  const { data: orders } = await sb
    .from('orders')
    .select('*, order_items(*, products(name, unit))')
    .eq('restaurant_id', profile.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-black">Mis pedidos</h1>
        <p className="text-gray-700 mt-1 text-sm">Historial de tus pedidos enviados a la nave</p>
      </div>

      <PedidosRestauranteClient orders={orders ?? []} />
    </div>
  )
}
