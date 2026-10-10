'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Ban, Search, ChevronDown, X, Undo2, Repeat, MessageCircle, Trash2 } from 'lucide-react'
import { updateOrderStatus, type ReturnReason } from '@/app/actions/orders'
import { setRepeatOrder, type RepeatOrderItem } from '@/lib/repeatOrder'
import { cn } from '@/lib/utils'
import { unitLabel } from '@/lib/units'
import { OrderChat } from '@/components/orders/OrderChat'
import { ReturnSheet, type ReturnLine } from '@/components/orders/ReturnSheet'
import { Pager, usePaged } from '@/components/ui/Pager'

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pendiente:      { label: 'Pendiente',      cls: 'bg-yellow-100 text-yellow-800' },
  en_preparacion: { label: 'En preparación', cls: 'bg-blue-100 text-blue-800' },
  hecho:          { label: 'Hecho',          cls: 'bg-blue-100 text-blue-800' },
  listo:          { label: 'Listo',          cls: 'bg-green-100 text-green-800' },
  entregado:      { label: 'Enviado',        cls: 'bg-green-100 text-green-800' },
  enviado:        { label: 'Enviado',        cls: 'bg-green-100 text-green-800' },
  cancelado:      { label: 'Cancelado',      cls: 'bg-red-100 text-red-700' },
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
type DeletedOrder = Order & { deleted_at: string | null; deleted_by_profile?: { full_name: string | null } | null }

const DELIVERED_STATUSES = new Set(['entregado', 'enviado'])

function isCanceledItem(item: OrderItem) {
  return item.rectified_quantity != null && Number(item.rectified_quantity) === 0
}

function alreadyReturned(order: Order, productId: string): number {
  return (order.delivery_notes ?? [])
    .filter(n => n.type === 'devolucion')
    .flatMap(n => n.delivery_note_items)
    .filter(i => i.product_id === productId)
    .reduce((sum, i) => sum + Number(i.delivered_quantity), 0)
}

function remainingToReturn(order: Order, item: OrderItem): number {
  if (!DELIVERED_STATUSES.has(order.status) || isCanceledItem(item)) return 0
  return Number(item.rectified_quantity ?? item.quantity) - alreadyReturned(order, item.product_id)
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

function fmtQty(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
}

// El chat solo se monta (y empieza a consultar al servidor) cuando el
// restaurante lo abre — antes se montaba uno por cada pedido de la lista y
// todos consultaban cada 6 s aunque nadie los mirase.
function ChatToggle({ orderId, currentUserId }: { orderId: string; currentUserId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors',
          open ? 'bg-gray-100 border-gray-300 text-black' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
        )}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {open ? 'Cerrar chat' : 'Chat con la nave'}
      </button>
      {open && (
        <div className="mt-3">
          <OrderChat orderId={orderId} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  )
}

function OrderRow({ order, onCanceled, onReturn, currentUserId }: {
  order: Order
  onCanceled: (id: string) => void
  onReturn: (orderId: string, productId: string) => void
  currentUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [loading, setLoading] = useState(false)
  const status = STATUS_STYLE[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-700' }
  const canCancel = order.status === 'pendiente'
  const liveItems = order.order_items?.filter(i => !isCanceledItem(i)) ?? []
  const canReturn = (order.order_items ?? []).some(i => remainingToReturn(order, i) > 0)

  function handleCancel() {
    setLoading(true)
    onCanceled(order.id)
    updateOrderStatus(order.id, 'cancelado')
  }

  function handleRepeat() {
    const items: RepeatOrderItem[] = order.order_items
      .filter(it => !isCanceledItem(it))
      .map(it => ({ product_id: it.product_id, quantity: Number(it.rectified_quantity ?? it.quantity) }))
    setRepeatOrder(items)
    router.push('/catalogo')
  }

  return (
    <div className={cn(
      'rounded-2xl border bg-white overflow-hidden',
      order.status === 'pendiente' ? 'border-yellow-200' : 'border-gray-100'
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/70 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-black text-sm">
            #{order.order_number}
            <span className="font-normal text-gray-600">
              {' · '}{new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {liveItems.length} producto{liveItems.length !== 1 ? 's' : ''} · {Number(order.total_price).toFixed(2)}€
          </p>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full shrink-0', status.cls)}>{status.label}</span>
        <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {order.notes && <p className="text-xs text-gray-700 italic pt-3">«{order.notes}»</p>}

          <div className="divide-y divide-gray-50 pt-1">
            {order.order_items?.map((item, i) => {
              const canceled = isCanceledItem(item)
              const rectified = !canceled && item.rectified_quantity != null && Number(item.rectified_quantity) !== Number(item.quantity)
              const remaining = remainingToReturn(order, item)
              return (
                <div key={i} className="py-2.5 flex items-start gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium leading-tight', canceled ? 'text-gray-500 line-through' : 'text-black')}>{item.products?.name}</p>
                    {canceled && <p className="text-xs text-red-600 mt-0.5">No disponible{item.rectification_note ? ` · ${item.rectification_note}` : ''}</p>}
                    {item.actual_weight != null && <p className="text-xs text-gray-600 mt-0.5">Peso real: {Number(item.actual_weight).toFixed(2)} kg</p>}
                    {DELIVERED_STATUSES.has(order.status) && !canceled && remaining <= 0 && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Undo2 className="w-3 h-3" /> Ya devuelto</p>
                    )}
                  </div>
                  {!canceled && (
                    <div className="text-right shrink-0">
                      {rectified ? (
                        <p className="text-amber-700 text-xs">
                          <span className="line-through text-gray-500">{fmtQty(Number(item.quantity))}</span>{' '}
                          <span className="font-semibold">{fmtQty(Number(item.rectified_quantity))} {unitLabel(item.unit)}</span>
                        </p>
                      ) : (
                        <p className="text-gray-700 text-xs font-medium">{fmtQty(Number(item.quantity))} {unitLabel(item.unit)}</p>
                      )}
                      {remaining > 0 && (
                        <button
                          onClick={() => onReturn(order.id, item.product_id)}
                          className="mt-1 text-xs font-semibold text-[#1E2B28] underline"
                        >
                          Devolver
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRepeat}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-[#1E2B28]/30 text-[#1E2B28] hover:bg-[#1E2B28]/10 transition-colors"
            >
              <Repeat className="w-3.5 h-3.5" /> Repetir pedido
            </button>
            {canReturn && (
              <button
                onClick={() => onReturn(order.id, '')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" /> Devolver algo de este pedido
              </button>
            )}
            {canCancel && (
              !confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" /> Cancelar pedido
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-medium">¿Seguro?</span>
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Cancelando…' : 'Sí, cancelar'}
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    No
                  </button>
                </div>
              )
            )}
            <ChatToggle orderId={order.id} currentUserId={currentUserId} />
          </div>
        </div>
      )}
    </div>
  )
}

export function PedidosRestauranteClient({ orders: initialOrders, deletedOrders = [], currentUserId }: { orders: Order[]; deletedOrders?: DeletedOrder[]; currentUserId: string }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [showDeleted, setShowDeleted] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnPreset, setReturnPreset] = useState<{ orderId: string; productId: string } | null>(null)
  const [returnOrderFilter, setReturnOrderFilter] = useState<string | null>(null)

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

  // Todas las líneas entregadas que todavía se pueden devolver, de más
  // reciente a más antigua (orders ya viene ordenado así del servidor).
  const returnLines: ReturnLine[] = useMemo(() => {
    const lines: ReturnLine[] = []
    for (const o of orders) {
      for (const item of o.order_items ?? []) {
        const remaining = remainingToReturn(o, item)
        if (remaining <= 0) continue
        lines.push({
          orderId: o.id, orderNumber: o.order_number, createdAt: o.created_at,
          productId: item.product_id, productName: item.products?.name ?? 'Producto',
          unit: item.unit, unitPrice: Number(item.unit_price), lotNumber: item.lot_number ?? null,
          remaining,
        })
      }
    }
    return lines
  }, [orders])

  function openReturn(orderId?: string, productId?: string) {
    setReturnPreset(orderId && productId ? { orderId, productId } : null)
    // Desde "Devolver algo de este pedido" se filtra la lista a ese pedido.
    setReturnOrderFilter(orderId && !productId ? orderId : null)
    setReturnOpen(true)
  }
  const sheetLines = returnOrderFilter ? returnLines.filter(l => l.orderId === returnOrderFilter) : returnLines

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

  // Con la paginación solo se dibujan 10 pedidos: los días de la página salen abiertos
  function isOpen(key: string, _idx: number) {
    if (key in toggled) return toggled[key]
    return true
  }

  const flat = useMemo(() => groups.flatMap(([, g]) => g), [groups])
  const paged = usePaged(flat, `${search}|${dateFilter}`)
  const visibleIds = new Set(paged.pageItems.map(o => o.id))

  function toggle(key: string, idx: number) {
    setToggled(prev => ({ ...prev, [key]: !isOpen(key, idx) }))
  }

  const hasFilters = search.trim() !== '' || dateFilter !== ''

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-20 text-gray-600">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p>No hay pedidos aún</p>
        </div>
        <DeletedOrdersSection orders={deletedOrders} show={showDeleted} onToggle={() => setShowDeleted(v => !v)} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Acción principal + búsqueda */}
      <button
        onClick={() => openReturn()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1E2B28] text-white font-semibold shadow-sm hover:bg-[#141F1C] active:scale-[0.99] transition-all"
      >
        <Undo2 className="w-5 h-5" />
        Devolver un producto
      </button>

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
            const rows = group.filter(o => visibleIds.has(o.id))
            if (rows.length === 0) return null
            const open = isOpen(key, idx)
            return (
              <div key={key}>
                <button
                  onClick={() => toggle(key, idx)}
                  className="w-full flex items-center justify-between px-1 py-2 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-black capitalize">{dayLabel(group[0].created_at)}</span>
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                      {group.length} {group.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform shrink-0', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="space-y-2">
                    {rows.map(order => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        onCanceled={handleCanceled}
                        onReturn={(orderId, productId) => openReturn(orderId, productId || undefined)}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <Pager {...paged} noun="pedidos" />
        </div>
      )}

      <DeletedOrdersSection orders={deletedOrders} show={showDeleted} onToggle={() => setShowDeleted(v => !v)} />

      {returnOpen && (
        <ReturnSheet
          lines={sheetLines}
          preset={returnPreset}
          onClose={() => setReturnOpen(false)}
          onReturned={handleReturned}
        />
      )}
    </div>
  )
}

// La nave puede eliminar un pedido por error (duplicado, mal introducido...).
// Este apartado es de solo lectura: el restaurante puede ver que se
// eliminó, cuándo, y qué llevaba, pero solo la nave puede restaurarlo.
function DeletedOrdersSection({ orders, show, onToggle }: { orders: DeletedOrder[]; show: boolean; onToggle: () => void }) {
  if (orders.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Trash2 className="h-4 w-4 text-gray-600" />
          <span className="font-semibold text-black text-sm">Pedidos eliminados por la nave</span>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{orders.length}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-gray-600 transition-transform shrink-0', show && 'rotate-180')} />
      </button>
      {show && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-gray-100">
          {orders.map(o => (
            <div key={o.id} className="text-sm rounded-xl px-3 py-2.5 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-black">#{o.order_number}</span>
                <span className="text-gray-600">{o.total_price.toFixed(2)}€</span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {o.order_items?.length ?? 0} producto{(o.order_items?.length ?? 0) !== 1 ? 's' : ''} · pedido el {new Date(o.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </p>
              {o.deleted_at && (
                <p className="text-xs text-red-500 mt-0.5">
                  Eliminado el {new Date(o.deleted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a las {new Date(o.deleted_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
