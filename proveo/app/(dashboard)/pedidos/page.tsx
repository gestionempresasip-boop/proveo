import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/helpers'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Clock } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  en_preparacion: 'bg-blue-100 text-blue-800 border-blue-200',
  listo: 'bg-green-100 text-green-800 border-green-200',
  entregado: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: '🕐 Pendiente',
  en_preparacion: '👨‍🍳 En preparación',
  listo: '✅ Listo para recoger',
  entregado: '📦 Entregado',
  cancelado: '❌ Cancelado',
}

export default async function PedidosPage() {
  const supabase = await createClient()
  const profile = await getAuthProfile()

  const isNave = profile.organizations.type === 'nave'

  type OrderWithDetails = {
    id: string; order_number: number; status: string; notes: string | null
    total_price: number; created_at: string; restaurant_id: string
    organizations: { name: string } | null
    order_items: Array<{
      quantity: number; unit: string
      products: { name: string; unit: string } | null
    }>
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  let query = sb
    .from('orders')
    .select('*, organizations(name), order_items(*, products(name, unit))')
    .order('created_at', { ascending: false })

  if (!isNave && profile.role !== 'admin') {
    query = query.eq('restaurant_id', profile.organization_id)
  }

  const { data: rawOrders } = await query
  const orders = (rawOrders ?? []) as OrderWithDetails[]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1E]">
          {isNave ? 'Pedidos entrantes' : 'Mis pedidos'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isNave
            ? 'Todos los pedidos recibidos de los restaurantes'
            : 'Historial de tus pedidos enviados a la nave'}
        </p>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay pedidos aún</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const org = order.organizations
            const items = order.order_items

            return (
              <Card key={order.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-[#1B4332] rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">#{order.order_number}</span>
                      </div>
                      <div>
                        {isNave && (
                          <p className="font-semibold text-[#1C1C1E]">{org?.name ?? 'Restaurante'}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                        {order.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{order.notes}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full border ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      <span className="font-bold text-[#1B4332]">
                        {Number(order.total_price).toFixed(2)}€
                      </span>
                    </div>
                  </div>

                  {/* Líneas del pedido */}
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {items.map((item, i) => (
                      <div key={i} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-[#1C1C1E]">{item.products?.name}</span>
                        <span className="text-gray-400 ml-2">{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
