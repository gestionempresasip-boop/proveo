import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Clock } from 'lucide-react'
import { PedidosNaveClient } from '@/components/orders/PedidosNaveClient'

const STATUS_COLORS: Record<string, string> = {
  pendiente:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_preparacion: 'bg-blue-100 text-blue-800 border-blue-200',
  hecho:          'bg-blue-100 text-blue-800 border-blue-200',
  listo:          'bg-green-100 text-green-800 border-green-200',
  entregado:      'bg-gray-100 text-gray-600 border-gray-200',
  enviado:        'bg-green-100 text-green-800 border-green-200',
  cancelado:      'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente:      '🕐 Pendiente',
  en_preparacion: '👨‍🍳 En preparación',
  hecho:          '✅ Hecho',
  listo:          '✅ Listo',
  entregado:      '📦 Enviado',
  enviado:        '📦 Enviado',
  cancelado:      '❌ Cancelado',
}

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
        <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Mis pedidos</h1>
        <p className="text-gray-500 mt-1 text-sm">Historial de tus pedidos enviados a la nave</p>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay pedidos aún</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <Card key={order.id} className="border-0 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#1B4332] rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">#{order.order_number}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {new Date(order.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      {order.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{order.notes}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[order.status] ?? ''}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <span className="font-bold text-[#1B4332]">{Number(order.total_price).toFixed(2)}€</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {order.order_items?.map((item: any, i: number) => (
                    <div key={i} className="text-xs bg-gray-50 rounded-xl px-3 py-2 flex justify-between">
                      <span className="font-medium text-[#1C1C1E]">{item.products?.name}</span>
                      <span className="text-gray-400">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
