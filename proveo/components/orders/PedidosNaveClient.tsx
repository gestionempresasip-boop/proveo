'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { updateOrderStatus, generateDeliveryNote, deleteOrder } from '@/app/actions/orders'
import type { OrderStatus } from '@/app/actions/orders'
import {
  Calendar, Filter, ChevronDown, MessageCircle, Printer,
  Download, FileText, Clock, CheckCircle2, Send, AlertCircle,
  ChevronUp, Package, Trash2
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────────────────

// Mapear estados viejos de la BD al nuevo sistema de 3 estados
function normalizeStatus(s: string): 'pendiente' | 'hecho' | 'enviado' | 'cancelado' {
  if (s === 'en_preparacion' || s === 'listo') return 'hecho'
  if (s === 'entregado') return 'enviado'
  return s as any
}

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
  hecho:     { label: 'Hecho',      color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: <CheckCircle2 className="w-3 h-3" /> },
  enviado:   { label: 'Enviado',    color: 'bg-green-100 text-green-800 border-green-200',    icon: <Send className="w-3 h-3" /> },
  cancelado: { label: 'Cancelado',  color: 'bg-red-100 text-red-700 border-red-200',          icon: <AlertCircle className="w-3 h-3" /> },
}

const NEXT: Record<string, { label: string; next: OrderStatus; color: string }> = {
  pendiente: { label: 'Marcar como hecho',    next: 'hecho',   color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  hecho:     { label: 'Marcar como enviado',  next: 'enviado', color: 'bg-[#1B4332] hover:bg-[#163828] text-white' },
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function startOfWeek(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x }
function isToday(d: Date) { const t = startOfDay(new Date()); return d >= t && d < new Date(t.getTime() + 86400000) }

// ── Types ───────────────────────────────────────────────────────────────────

type OrderItem = { id: string; product_id: string; quantity: number; unit: string; unit_price: number; total_price: number; products: { name: string } | null }
type DeliveryNote = { id: string; note_number: number }
type Order = {
  id: string; order_number: number; status: string; notes: string | null
  total_price: number; created_at: string; restaurant_id: string
  organizations: { id: string; name: string } | null
  order_items: OrderItem[]
  delivery_notes: DeliveryNote[]
}
type Restaurant = { id: string; name: string }

// ── Action buttons per order ─────────────────────────────────────────────────

function OrderActions({ order, onDeleted }: { order: Order; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [noteId, setNoteId] = useState<string | null>(order.delivery_notes?.[0]?.id ?? null)
  const [noteNumber, setNoteNumber] = useState<number | null>(order.delivery_notes?.[0]?.note_number ?? null)
  const [, startTransition] = useTransition()

  const status = normalizeStatus(order.status)
  const nextAction = NEXT[status]

  async function handleStatus() {
    if (!nextAction) return
    setLoading(true)
    await updateOrderStatus(order.id, nextAction.next)
    setLoading(false)
  }

  async function handleGenNote() {
    setLoading(true)
    startTransition(async () => {
      const id = await generateDeliveryNote(order.id)
      if (id) setNoteId(id)
      setLoading(false)
    })
  }

  function shareWhatsApp() {
    const items = order.order_items.map(i => `• ${i.products?.name ?? '?'}: ${i.quantity} ${i.unit}`).join('\n')
    const text = `*Pedido #${order.order_number} — ${order.organizations?.name ?? 'Restaurante'}*\n`
      + `Estado: ${STATUS_CONFIG[status]?.label}\n\n`
      + `Productos:\n${items}\n\n`
      + `*Total: ${Number(order.total_price).toFixed(2)}€*`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function exportCSV() {
    const header = 'Producto,Cantidad,Unidad,Precio ud.,Total'
    const rows = order.order_items.map(i =>
      [`"${i.products?.name ?? ''}"`, i.quantity, i.unit,
       Number(i.unit_price).toFixed(2), Number(i.total_price).toFixed(2)].join(',')
    )
    const csv = [
      `Pedido #${order.order_number} — ${order.organizations?.name}`,
      `Fecha: ${new Date(order.created_at).toLocaleDateString('es-ES')}`,
      `Estado: ${STATUS_CONFIG[status]?.label}`,
      '',
      header,
      ...rows,
      '',
      `Total,,,, ${Number(order.total_price).toFixed(2)}`,
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `pedido-${order.order_number}.csv`; a.click()
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {/* Cambio de estado */}
      {nextAction && (
        <button
          onClick={handleStatus}
          disabled={loading}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ${nextAction.color}`}
        >
          {loading ? 'Actualizando...' : nextAction.label}
        </button>
      )}

      {/* Albarán */}
      {noteId ? (
        <Link
          href={`/albaranes/${noteId}`}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-[#1B4332] text-[#1B4332] hover:bg-green-50 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          {noteNumber ? `Albarán #${noteNumber}` : 'Ver albarán'}
        </Link>
      ) : (status === 'hecho' || status === 'enviado') ? (
        <button
          onClick={handleGenNote}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <FileText className="w-3.5 h-3.5" />
          Generar albarán
        </button>
      ) : null}

      {/* WhatsApp */}
      <button
        onClick={shareWhatsApp}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        WhatsApp
      </button>

      {/* CSV / Excel */}
      <button
        onClick={exportCSV}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Excel / CSV
      </button>

      {/* Imprimir */}
      {noteId && (
        <Link
          href={`/albaranes/${noteId}`}
          target="_blank"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir
        </Link>
      )}

      {/* Eliminar */}
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </button>
      ) : (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-red-600 font-medium">¿Seguro?</span>
          <button
            onClick={async () => { setLoading(true); await deleteOrder(order.id); onDeleted(order.id) }}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onDeleted }: { order: Order; onDeleted: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const status = normalizeStatus(order.status)
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente
  const date = new Date(order.created_at)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      status === 'pendiente' ? 'border-yellow-200' : status === 'hecho' ? 'border-blue-200' : 'border-gray-100'
    }`}>
      {/* Header */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-10 h-10 bg-[#1B4332] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">#{order.order_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-[#1C1C1E] truncate">{order.organizations?.name ?? 'Restaurante'}</p>
            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400">
              {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {order.order_items.length} producto{order.order_items.length !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold text-[#1B4332] text-sm ml-auto">{Number(order.total_price).toFixed(2)}€</span>
          </div>
          {order.notes && <p className="text-xs text-gray-400 italic mt-1 truncate">"{order.notes}"</p>}
        </div>
        <div className="shrink-0 text-gray-400 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded: items + actions */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3">
            {order.order_items.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                <span className="font-medium text-[#1C1C1E] truncate">{item.products?.name ?? '—'}</span>
                <span className="text-gray-500 ml-2 shrink-0">{item.quantity} {item.unit}</span>
              </div>
            ))}
          </div>
          <OrderActions order={order} onDeleted={onDeleted} />
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

type DateFilter = 'hoy' | 'semana' | 'mes' | 'custom'
type StatusFilter = 'todos' | 'pendiente' | 'hecho' | 'enviado'

export function PedidosNaveClient({ orders: initialOrders, restaurants }: { orders: Order[]; restaurants: Restaurant[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoy')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [restFilter, setRestFilter] = useState('todos')

  function handleDeleted(id: string) { setOrders(prev => prev.filter(o => o.id !== id)) }
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const today = startOfDay(new Date())
  const todayLabel = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const filtered = useMemo(() => {
    return orders.filter(order => {
      const d = new Date(order.created_at)
      const norm = normalizeStatus(order.status)

      // Date filter
      let passDate = false
      if (dateFilter === 'hoy') {
        // Mostrar pedidos de hoy + pendientes de días anteriores
        passDate = isToday(d) || norm === 'pendiente'
      } else if (dateFilter === 'semana') {
        passDate = d >= startOfWeek(new Date())
      } else if (dateFilter === 'mes') {
        passDate = d >= startOfMonth(new Date())
      } else if (dateFilter === 'custom') {
        const from = dateFrom ? new Date(dateFrom) : null
        const to = dateTo ? new Date(new Date(dateTo).getTime() + 86399999) : null
        passDate = (!from || d >= from) && (!to || d <= to)
      }

      // Status filter
      const passStatus = statusFilter === 'todos' || norm === statusFilter

      // Restaurant filter
      const passRest = restFilter === 'todos' || order.restaurant_id === restFilter

      return passDate && passStatus && passRest
    })
  }, [orders, dateFilter, statusFilter, restFilter, dateFrom, dateTo])

  // Split: today vs past-pending (only in "hoy" mode)
  const todayOrders = dateFilter === 'hoy' ? filtered.filter(o => isToday(new Date(o.created_at))) : filtered
  const pastPending = dateFilter === 'hoy' ? filtered.filter(o => !isToday(new Date(o.created_at))) : []

  const counts = {
    pendiente: orders.filter(o => normalizeStatus(o.status) === 'pendiente').length,
    hecho:     orders.filter(o => normalizeStatus(o.status) === 'hecho').length,
    enviado:   orders.filter(o => normalizeStatus(o.status) === 'enviado').length,
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Pedidos entrantes</h1>
        <p className="text-gray-500 text-sm mt-1 capitalize">{todayLabel}</p>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pendiente', label: 'Pendientes', n: counts.pendiente, color: 'bg-yellow-100 text-yellow-800' },
          { key: 'hecho',     label: 'Hechos',     n: counts.hecho,     color: 'bg-blue-100 text-blue-800' },
          { key: 'enviado',   label: 'Enviados',   n: counts.enviado,   color: 'bg-green-100 text-green-800' },
        ].map(c => (
          <button
            key={c.key}
            onClick={() => setStatusFilter(s => s === c.key ? 'todos' : c.key as StatusFilter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${c.color} ${statusFilter === c.key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}
          >
            {c.label} ({c.n})
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Date tabs */}
        <div className="flex border-b border-gray-100">
          {([['hoy','Hoy'],['semana','Semana'],['mes','Mes'],['custom','Personalizado']] as [DateFilter,string][]).map(([k,l]) => (
            <button
              key={k}
              onClick={() => setDateFilter(k)}
              className={`flex-1 py-3 text-xs sm:text-sm font-medium transition-colors ${
                dateFilter === k ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-400 block mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-400 block mb-1">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
            </div>
          </div>
        )}

        {/* Restaurant + status filters */}
        <div className="flex flex-wrap gap-3 p-4">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-400 block mb-1">Restaurante</label>
            <div className="relative">
              <select
                value={restFilter}
                onChange={e => setRestFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] appearance-none pr-8"
              >
                <option value="todos">Todos los restaurantes</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-400 block mb-1">Estado</label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] appearance-none pr-8"
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="hecho">Hecho</option>
                <option value="enviado">Enviado</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Past pending (only in "hoy" mode) */}
      {dateFilter === 'hoy' && pastPending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-orange-600 flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" />
            Pendientes de días anteriores ({pastPending.length})
          </h2>
          <div className="space-y-3">
            {pastPending.map(o => <OrderCard key={o.id} order={o} onDeleted={handleDeleted} />)}
          </div>
        </section>
      )}

      {/* Today's orders / filtered orders */}
      <section>
        {dateFilter === 'hoy' && (
          <h2 className="text-sm font-semibold text-[#1C1C1E] flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#1B4332]" />
            Pedidos de hoy ({todayOrders.length})
          </h2>
        )}
        {todayOrders.length === 0 && pastPending.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-medium">No hay pedidos para este período</p>
            {dateFilter === 'hoy' && <p className="text-sm mt-1">Los pedidos de hoy aparecerán aquí cuando lleguen</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {todayOrders.map(o => <OrderCard key={o.id} order={o} onDeleted={handleDeleted} />)}
          </div>
        )}
      </section>
    </div>
  )
}
