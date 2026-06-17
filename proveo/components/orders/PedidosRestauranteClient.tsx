'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Clock, Trash2 } from 'lucide-react'
import { deleteOrder } from '@/app/actions/orders'

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

type OrderItem = { id: string; quantity: number; unit: string; products: { name: string; unit: string } | null }
type Order = { id: string; order_number: number; status: string; notes: string | null; total_price: number; created_at: string; order_items: OrderItem[] }

function OrderRow({ order, onDeleted }: { order: Order; onDeleted: (id: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await deleteOrder(order.id)
    onDeleted(order.id)
  }

  return (
    <Card className="border-0 shadow-sm">
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
          {order.order_items?.map((item, i) => (
            <div key={i} className="text-xs bg-gray-50 rounded-xl px-3 py-2 flex justify-between">
              <span className="font-medium text-[#1C1C1E]">{item.products?.name}</span>
              <span className="text-gray-400">{item.quantity} {item.unit}</span>
            </div>
          ))}
        </div>

        {/* Eliminar */}
        <div className="mt-3 flex justify-end">
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar pedido
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">¿Seguro que quieres eliminarlo?</span>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function PedidosRestauranteClient({ orders: initialOrders }: { orders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  function handleDeleted(id: string) { setOrders(prev => prev.filter(o => o.id !== id)) }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
        <p>No hay pedidos aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <OrderRow key={order.id} order={order} onDeleted={handleDeleted} />
      ))}
    </div>
  )
}
