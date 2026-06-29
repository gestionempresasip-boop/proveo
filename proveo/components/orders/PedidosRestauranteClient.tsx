'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Clock, Ban, Search, ChevronDown, X, Undo2, ThumbsUp, AlertTriangle, Repeat } from 'lucide-react'
import { updateOrderStatus, createReturn, type ReturnReason } from '@/app/actions/orders'
import { setRepeatOrder, type RepeatOrderItem } from '@/lib/repeatOrder'
import { cn } from '@/lib/utils'
import { unitLabel } from '@/lib/units'

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

type OrderItem = {
  id: string; product_id: string; quantity: number; rectified_quantity?: number | null; rectification_note?: string | null
  unit: string; unit_price: number; lot_number?: string | null; actual_weight?: number | null
  products: { name: string; unit: string } | null
}
type ReturnDeliveryNoteItem = { product_id: string; delivered_quantity: number; return_reason: ReturnReason | null }
type ReturnDeliveryNote = { id: string; type: 'entrega' | 'devolucion'; delivery_note_items: ReturnDeliveryNoteItem[] }
type Order = {
  id: string; order_number: number; status: string; notes: string | null; total_price: number; created_at: string
  order_items: OrderItem[]; delivery_notes?: ReturnDeliveryNote[]
}

const DELIVERED_STATUSES = new Set(['entregado', 'enviado'])

function alreadyReturned(order: Order, productId: string): number {
  return (order.delivery_notes ?? [])
    .filter(n => n.type === 'devolucion')
    .flatMap(n => n.delivery_note_items)
    .filter(i => i.product_id === productId)
    .reduce((sum, i) => sum + Number(i.delivered_quantity), 0)
}

// Botones de devolución de un artículo ya entregado. "Reutilizable" (error
// de pedido, no se necesita...) repone stock en la nave; "No utilizable"
// (mal estado, rotura...) no repone — la nave nunca podría volver a venderlo.
function ReturnControls({ order, item, onReturned }: { order: Order; item: OrderItem; onReturned: (orderId: string, productId: string, qty: number, reason: ReturnReason) => void }) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const delivered = Number(item.rectified_quantity ?? item.quantity)
  const remaining = delivered - alreadyReturned(order, item.product_id)

  if (remaining <= 0) {
    return (
      <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-lg">
        <Undo2 className="w-3.5 h-3.5" /> Ya devuelto
      </span>
    )
  }

  function submit(reason: ReturnReason) {
    const q = parseFloat((qty || String(remaining)).replace(',', '.'))
    if (isNaN(q) || q <= 0 || q > remaining) { setError(`Cantidad entre 0 y ${remaining}`); return }
    setError(null)
    setPending(true)
    onReturned(order.id, item.product_id, q, reason)
    createReturn(order.id, [{
      product_id: item.product_id, quantity: q, unit: item.unit, unit_price: Number(item.unit_price),
      reason, lot_number: item.lot_number ?? null,
    }])
      .then(() => { setOpen(false); setQty('') })
      .catch((e: any) => {
        onReturned(order.id, item.product_id, -q, reason)
        setError(e?.message ?? 'No se pudo registrar la devolución, inténtalo de nuevo')
      })
      .finally(() => setPending(false))
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E2B28] bg-[#1E2B28]/10 border border-[#1E2B28]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#1E2B28]/20 transition-colors"
      >
        <Undo2 className="w-3.5 h-3.5" /> Devolver artículo
      </button>
    )
  }

  return (
    <div className="mt-1.5 p-2 rounded-lg bg-white border border-gray-200 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="number" step="0.001" min="0" max={remaining} autoFocus
          placeholder={String(remaining)}
          value={qty} onChange={e => setQty(e.target.value)}
          className="w-16 border border-gray-200 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
        />
        <span className="text-[11px] text-gray-600">{unitLabel(item.unit)} de {remaining} disponibles</span>
        <button onClick={() => { setOpen(false); setQty(''); setError(null) }} className="ml-auto p-0.5 rounded text-gray-600 hover:bg-gray-100"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          disabled={pending} onClick={() => submit('reutilizable')}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
        >
          <ThumbsUp className="w-3 h-3" /> Error de pedido / no se necesita
        </button>
        <button
          disabled={pending} onClick={() => submit('no_utilizable')}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50"
        >
          <AlertTriangle className="w-3 h-3" /> Mal estado / no se puede usar
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

function dayKey(dateStr: string): string {
  const d = new Date(dateStr)
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

  if (sameDay(d, today)) return 'Hoy'
  if (sameDay(d, yesterday)) return 'Ayer'

  return d.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function OrderRow({ order, onCanceled, onReturned }: { order: Order; onCanceled: (id: string) => void; onReturned: (orderId: string, productId: string, qty: number, reason: ReturnReason) => void }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const canCancel = order.status === 'pendiente'
  const canReturn = DELIVERED_STATUSES.has(order.status)

  function handleCancel() {
    setLoading(true)
    onCanceled(order.id)
    updateOrderStatus(order.id, 'cancelado')
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[#1E2B28] rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">#{order.order_number}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Clock className="h-3 w-3" />
                {new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {order.notes && (
                <p className="text-xs text-gray-700 mt-1 italic">"{order.notes}"</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[order.status] ?? ''}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {order.order_items?.map((item, i) => {
            const isCanceled = item.rectified_quantity != null && Number(item.rectified_quantity) === 0
            const isRectified = !isCanceled && item.rectified_quantity != null && Number(item.rectified_quantity) !== Number(item.quantity)
            if (isCanceled) {
              return (
                <div key={i} className="text-xs rounded-xl px-3 py-2 bg-red-50 border border-red-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-black flex items-center gap-1.5">
                      <Ban className="h-3 w-3 text-red-500 shrink-0" />{item.products?.name}
                    </span>
                    <span className="text-red-600 font-semibold shrink-0 ml-2">❌ No disponible</span>
                  </div>
                  {item.rectification_note && <p className="text-red-500 mt-0.5">{item.rectification_note}</p>}
                </div>
              )
            }
            return (
              <div key={i} className={cn('text-xs rounded-xl px-3 py-2', isRectified ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50')}>
                <div className="flex justify-between">
                  <span className="font-medium text-black">{item.products?.name}</span>
                  {isRectified ? (
                    <span className="text-amber-700 shrink-0 ml-2">
                      Pedido: <span className="line-through text-gray-600">{item.quantity}</span> · Confirmado: <span className="font-semibold">{item.rectified_quantity} {unitLabel(item.unit)}</span>
                    </span>
                  ) : (
                    <span className="text-gray-600 shrink-0 ml-2">{item.quantity} {unitLabel(item.unit)}</span>
                  )}
                </div>
                {item.actual_weight != null && (
                  <p className="text-gray-600 mt-0.5">Peso real: {Number(item.actual_weight).toFixed(2)} kg</p>
                )}
                {canReturn && <ReturnControls order={order} item={item} onReturned={onReturned} />}
              </div>
            )
          })}
        </div>

        {/* Repetir pedido */}
        {order.status !== 'cancelado' && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                const items: RepeatOrderItem[] = order.order_items
                  .filter(it => !(it.rectified_quantity != null && Number(it.rectified_quantity) === 0))
                  .map(it => ({ product_id: it.product_id, quantity: Number(it.rectified_quantity ?? it.quantity) }))
                setRepeatOrder(items)
                router.push('/catalogo')
              }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-[#1E2B28]/30 text-[#1E2B28] hover:bg-[#1E2B28]/10 transition-colors"
            >
              <Repeat className="w-3.5 h-3.5" />
              Repetir pedido
            </button>
          </div>
        )}

        {/* Cancelar */}
        {canCancel && (
          <div className="mt-3 flex justify-end">
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancelar pedido
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">¿Seguro que quieres cancelarlo?</span>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Volver
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PedidosRestauranteClient({ orders: initialOrders }: { orders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  function handleCanceled(id: string) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelado' } : o))
  }

  // Refleja la devolución al instante sin esperar la respuesta del servidor:
  // se añade una nota de tipo "devolucion" sintética con la línea devuelta,
  // igual que vería el restaurante tras recargar la página.
  function handleReturned(orderId: string, productId: string, qty: number, reason: ReturnReason) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const notes = o.delivery_notes ?? []
      return {
        ...o,
        delivery_notes: [
          ...notes,
          { id: `optimistic-${Date.now()}`, type: 'devolucion', delivery_note_items: [{ product_id: productId, delivered_quantity: qty, return_reason: reason }] },
        ],
      }
    }))
  }

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (dateFilter && dayKey(o.created_at) !== dateFilter) return false
      if (search) {
        const q = search.trim().toLowerCase()
        const matchNum = String(o.order_number).includes(q)
        const matchNotes = o.notes?.toLowerCase().includes(q) ?? false
        const matchProduct = o.order_items?.some(it => it.products?.name?.toLowerCase().includes(q))
        if (!matchNum && !matchNotes && !matchProduct) return false
      }
      return true
    })
  }, [orders, search, dateFilter])

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>()
    filtered.forEach(o => {
      const key = dayKey(o.created_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  function isOpen(key: string, idx: number) {
    if (key in toggled) return toggled[key]
    return idx < 2
  }

  function toggle(key: string, idx: number) {
    setToggled(prev => ({ ...prev, [key]: !isOpen(key, idx) }))
  }

  const hasFilters = search.trim() !== '' || dateFilter !== ''

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 text-gray-600">
        <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
        <p>No hay pedidos aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nº de pedido, producto o nota..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] focus:border-transparent placeholder-gray-600"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1E2B28] focus:border-transparent"
        />
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setDateFilter('') }}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin resultados</p>
          <p className="text-sm mt-1">No hay pedidos que coincidan con la búsqueda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([key, group], idx) => {
            const open = isOpen(key, idx)
            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggle(key, idx)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-black capitalize">{dayLabel(group[0].created_at)}</span>
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                      {group.length} {group.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-gray-600 transition-transform shrink-0', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
                    {group.map(order => (
                      <OrderRow key={order.id} order={order} onCanceled={handleCanceled} onReturned={handleReturned} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
