'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { updateOrderStatus, generateDeliveryNote, deleteOrder, restoreOrder, rectifyOrderItem, cancelOrderItem, setItemPrepared, setItemLot, setItemWeight, setItemBoxExactUnits, reopenOrder } from '@/app/actions/orders'
import type { OrderStatus } from '@/app/actions/orders'
import { unitLabel } from '@/lib/units'
import { OrderChat } from '@/components/orders/OrderChat'
import {
  Calendar, Filter, ChevronDown, MessageCircle, Printer,
  Download, FileText, Clock, CheckCircle2, Send, AlertCircle,
  ChevronUp, Package, Trash2, Pencil, Check, X, Ban, Undo2, RotateCcw
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
  hecho:     { label: 'Marcar como enviado',  next: 'enviado', color: 'bg-[#1E2B28] hover:bg-[#141F1C] text-white' },
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function startOfWeek(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x }
function startOfMonth(d: Date) { const x = startOfDay(d); x.setDate(1); return x }
function isToday(d: Date) { const t = startOfDay(new Date()); return d >= t && d < new Date(t.getTime() + 86400000) }

// ── Types ───────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string; product_id: string; quantity: number; rectified_quantity?: number | null
  rectification_note?: string | null
  prepared?: boolean; lot_number?: string | null; actual_weight?: number | null
  unit: string; unit_price: number; total_price: number; products: { name: string } | null
  order_mode?: 'unidad' | 'cajon' | null
  box_count?: number | null
  box_approximate_units?: number | null
  box_exact_units?: number | null
}
type ReturnItem = { product_id: string; delivered_quantity: number; return_reason: 'reutilizable' | 'no_utilizable' | null; products: { name: string } | null }
type DeliveryNote = { id: string; note_number: number; type?: 'entrega' | 'devolucion'; delivery_note_items?: ReturnItem[] }
type Order = {
  id: string; order_number: number; status: string; notes: string | null
  total_price: number; created_at: string; restaurant_id: string
  organizations: { id: string; name: string } | null
  order_items: OrderItem[]
  delivery_notes: DeliveryNote[]
  deleted_at?: string | null
  deleted_by_profile?: { full_name: string | null } | null
}

function entregaNote(order: Order): DeliveryNote | undefined {
  return order.delivery_notes?.find(n => (n.type ?? 'entrega') === 'entrega')
}
function returnNotes(order: Order): DeliveryNote[] {
  return order.delivery_notes?.filter(n => n.type === 'devolucion') ?? []
}
type Restaurant = { id: string; name: string }

// ── Línea de pedido rectificable ──────────────────────────────────────────────

function ItemRow({
  item, onRectified, onCanceled, onPreparedChange, onLotChange, onWeightChange, onBoxExactUnitsChange,
}: {
  item: OrderItem
  onRectified: (itemId: string, qty: number, note?: string) => void
  onCanceled: (itemId: string, reason?: string) => void
  onPreparedChange: (itemId: string, prepared: boolean) => void
  onLotChange: (itemId: string, lot: string) => void
  onWeightChange: (itemId: string, weight: number | null) => void
  onBoxExactUnitsChange: (itemId: string, exactUnits: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(item.rectified_quantity ?? item.quantity))
  const [note, setNote] = useState(item.rectification_note ?? '')
  const [lot, setLot] = useState(item.lot_number ?? '')
  const [weight, setWeight] = useState(item.actual_weight != null ? String(item.actual_weight) : '')
  const [boxExact, setBoxExact] = useState(item.box_exact_units != null ? String(item.box_exact_units) : '')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [boxSyncError, setBoxSyncError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isCajon = item.order_mode === 'cajon'
  const isCanceled = item.rectified_quantity != null && Number(item.rectified_quantity) === 0
  const isRectified = item.rectified_quantity != null && Number(item.rectified_quantity) !== Number(item.quantity)

  // Optimista, pero con reversión visible si la escritura en el servidor
  // falla (en vez de quedarse "marcado" en pantalla sin haberse guardado).
  async function togglePrepared() {
    const next = !item.prepared
    onPreparedChange(item.id, next)
    try {
      await setItemPrepared(item.id, next)
    } catch {
      onPreparedChange(item.id, !next)
      setSyncError('No se pudo guardar, inténtalo de nuevo')
      setTimeout(() => setSyncError(null), 3000)
    }
  }

  async function saveLot() {
    const previous = item.lot_number ?? ''
    if (lot === previous) return
    onLotChange(item.id, lot)
    try {
      await setItemLot(item.id, lot)
    } catch {
      setLot(previous)
      onLotChange(item.id, previous)
      setSyncError('No se pudo guardar el lote, inténtalo de nuevo')
      setTimeout(() => setSyncError(null), 3000)
    }
  }

  // Peso real de la línea (ej: "3 ud" pedidas, pero pesan 2,4 kg en total) —
  // opcional, para productos que se piden por unidad pero se facturan/anotan
  // también por peso real servido.
  async function saveWeight() {
    const previousNum = item.actual_weight ?? null
    const parsed = weight.trim() === '' ? null : parseFloat(weight.replace(',', '.'))
    const next = parsed != null && !isNaN(parsed) ? parsed : null
    if (next === previousNum) return
    onWeightChange(item.id, next)
    try {
      await setItemWeight(item.id, next)
    } catch {
      setWeight(previousNum != null ? String(previousNum) : '')
      onWeightChange(item.id, previousNum)
      setSyncError('No se pudo guardar el peso, inténtalo de nuevo')
      setTimeout(() => setSyncError(null), 3000)
    }
  }

  async function saveBoxExactUnits() {
    const parsed = parseInt(boxExact.trim(), 10)
    if (isNaN(parsed) || parsed <= 0) return
    const prev = item.box_exact_units
    if (parsed === prev) return
    onBoxExactUnitsChange(item.id, parsed)
    try {
      await setItemBoxExactUnits(item.id, parsed)
    } catch {
      setBoxExact(prev != null ? String(prev) : '')
      onBoxExactUnitsChange(item.id, prev ?? 0)
      setBoxSyncError('No se pudo guardar las unidades exactas, inténtalo de nuevo')
      setTimeout(() => setBoxSyncError(null), 3000)
    }
  }

  function save() {
    const qty = parseFloat(value.replace(',', '.'))
    if (isNaN(qty) || qty < 0) return
    const prevQty = item.rectified_quantity ?? item.quantity
    const prevNote = item.rectification_note
    startTransition(async () => {
      onRectified(item.id, qty, note || undefined)
      try {
        await rectifyOrderItem(item.id, qty, note || undefined)
        setEditing(false)
      } catch {
        onRectified(item.id, prevQty, prevNote ?? undefined)
        setSyncError('No se pudo guardar, inténtalo de nuevo')
        setTimeout(() => setSyncError(null), 3000)
      }
    })
  }

  function cancelItem() {
    const reason = note || 'Cancelado por la nave'
    const prevQty = item.rectified_quantity ?? item.quantity
    const prevNote = item.rectification_note
    startTransition(async () => {
      onCanceled(item.id, reason)
      try {
        await cancelOrderItem(item.id, reason)
        setEditing(false)
      } catch {
        onRectified(item.id, prevQty, prevNote ?? undefined)
        setSyncError('No se pudo cancelar, inténtalo de nuevo')
        setTimeout(() => setSyncError(null), 3000)
      }
    })
  }

  if (editing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-2 py-1.5 text-xs space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-black truncate flex-1">{item.products?.name ?? '—'}</span>
          {!isCajon && (
            <>
              <input
                type="number" step="0.001" min="0" autoFocus value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save() }}
                className="w-16 border border-amber-300 rounded-lg px-1.5 py-1 text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-gray-600 shrink-0">{unitLabel(item.unit)}</span>
              <button onClick={save} disabled={pending} className="p-1 rounded text-green-600 hover:bg-green-50 shrink-0"><Check className="w-3.5 h-3.5" /></button>
            </>
          )}
          <button onClick={() => { setEditing(false); setValue(String(item.rectified_quantity ?? item.quantity)); setNote(item.rectification_note ?? '') }} className="p-1 rounded text-gray-600 hover:bg-gray-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
        <input
          type="text" placeholder="Motivo (opcional): rotura de stock, mal estado..."
          value={note} onChange={e => setNote(e.target.value)}
          className="w-full border border-amber-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button onClick={cancelItem} disabled={pending} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg">
          <Ban className="w-3 h-3" /> Cancelar este artículo
        </button>
      </div>
    )
  }

  if (isCanceled) {
    return (
      <div className="rounded-xl px-3 py-2 text-xs bg-red-50 border border-red-200">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-black truncate flex items-center gap-1.5">
            <Ban className="w-3 h-3 text-red-500 shrink-0" />{item.products?.name ?? '—'}
          </span>
          <span className="text-red-600 font-semibold shrink-0">❌ Cancelado</span>
        </div>
        {item.rectification_note && <p className="text-red-500 mt-0.5 truncate">{item.rectification_note}</p>}
        <button onClick={() => setEditing(true)} className="text-gray-600 hover:text-amber-600 mt-1 flex items-center gap-1">
          <Pencil className="w-3 h-3" /> Editar
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-xl px-3 py-2 text-xs space-y-1.5 ${isRectified ? 'bg-amber-50 border border-amber-200' : item.prepared ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 min-w-0 cursor-pointer">
          <input
            type="checkbox"
            checked={!!item.prepared}
            onChange={togglePrepared}
            title="Listo / cargado en la furgoneta"
            className="accent-green-600 shrink-0 w-4 h-4"
          />
          <span className={`font-medium truncate ${item.prepared ? 'text-green-700' : 'text-black'}`}>
            {item.products?.name ?? '—'}
          </span>
        </label>
        <div className="flex items-center gap-1.5 shrink-0">
          {isCajon ? (
            <span className="text-blue-800 text-[11px]">
              {item.box_count} caja{(item.box_count ?? 1) !== 1 ? 's' : ''}
              {' '}
              {item.box_exact_units != null
                ? <span className="font-semibold">· {item.box_exact_units} und/caj.</span>
                : <span className="text-gray-500">≈{item.box_approximate_units} und/caj.</span>
              }
            </span>
          ) : isRectified ? (
            <span className="text-amber-700">
              <span className="line-through text-gray-600">{item.quantity}</span> → <span className="font-semibold">{item.rectified_quantity} {unitLabel(item.unit)}</span>
            </span>
          ) : (
            <span className="text-gray-700">{item.quantity} {unitLabel(item.unit)}</span>
          )}
          <button
            onClick={() => setEditing(true)}
            title={isCajon ? 'Cancelar producto' : 'Rectificar cantidad'}
            className={`p-1 rounded ${isCajon ? 'text-gray-600 hover:text-red-600 hover:bg-red-50' : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'}`}
          >
            {isCajon ? <Ban className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 pl-6">
        <span className="text-gray-600 shrink-0">Lote:</span>
        <input
          type="text"
          value={lot}
          onChange={e => setLot(e.target.value)}
          onBlur={saveLot}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="Sin especificar"
          className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E2B28] placeholder-gray-500"
        />
      </div>
      <div className="flex items-center gap-1.5 pl-6">
        <span className="text-gray-600 shrink-0">Peso real:</span>
        <input
          type="number" step="0.001" min="0"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={saveWeight}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="Si pesa distinto a lo pedido"
          className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E2B28] placeholder-gray-500"
        />
        <span className="text-gray-600 shrink-0">kg</span>
      </div>
      {isCajon && (
        <div className="flex items-center gap-1.5 pl-6 bg-blue-50 rounded-lg py-1.5 px-2 -mx-0 mt-0.5">
          <span className="text-blue-800 shrink-0 text-[11px] font-medium">
            Unidades exactas/caja:
          </span>
          <input
            type="number" step="1" min="1"
            value={boxExact}
            onChange={e => setBoxExact(e.target.value)}
            onBlur={saveBoxExactUnits}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder={String(item.box_approximate_units ?? '≈')}
            className="flex-1 min-w-0 bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
          />
          <span className="text-blue-700 shrink-0 text-[11px]">und</span>
          {item.box_count != null && boxExact && !isNaN(parseInt(boxExact)) && (
            <span className="text-blue-600 shrink-0 text-[11px]">
              = {item.box_count * parseInt(boxExact)} tot.
            </span>
          )}
        </div>
      )}
      {boxSyncError && <p className="text-red-600 pl-6 text-[11px]">{boxSyncError}</p>}
      {syncError && <p className="text-red-600 pl-6">{syncError}</p>}
    </div>
  )
}

// ── Action buttons per order ─────────────────────────────────────────────────

function OrderActions({ order, onDeleted, onStatusChange }: { order: Order; onDeleted: (order: Order) => void; onStatusChange: (id: string, status: OrderStatus) => void }) {
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reopenError, setReopenError] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(entregaNote(order)?.id ?? null)
  const [noteNumber, setNoteNumber] = useState<number | null>(entregaNote(order)?.note_number ?? null)
  const [blockedMsg, setBlockedMsg] = useState(false)
  const [, startTransition] = useTransition()

  const status = normalizeStatus(order.status)
  const nextAction = NEXT[status]

  const pendingItems = order.order_items.filter(i => Number(i.rectified_quantity ?? -1) !== 0)
  const allPrepared = pendingItems.length > 0 && pendingItems.every(i => i.prepared)
  const needsPrepCheck = status === 'pendiente'
  const canCancelOrder = status === 'pendiente' || status === 'hecho'
  const canReopen = status === 'cancelado'

  function handleStatus() {
    if (!nextAction) return
    if (needsPrepCheck && !allPrepared) {
      setBlockedMsg(true)
      setTimeout(() => setBlockedMsg(false), 3000)
      return
    }
    onStatusChange(order.id, nextAction.next)
    updateOrderStatus(order.id, nextAction.next)
  }

  function handleCancelOrder() {
    setLoading(true)
    onStatusChange(order.id, 'cancelado')
    updateOrderStatus(order.id, 'cancelado')
  }

  // Restablece un pedido cancelado por error: mismo número de pedido,
  // vuelve a "pendiente" y se descuenta otra vez el stock de la nave. Aquí
  // sí esperamos la respuesta (a diferencia del resto de acciones) porque
  // si falla el restaurante seguiría creyendo que el pedido está cancelado.
  function handleReopen() {
    setReopening(true)
    setReopenError(null)
    reopenOrder(order.id)
      .then(() => onStatusChange(order.id, 'pendiente'))
      .catch((e: any) => setReopenError(e?.message ?? 'No se pudo restablecer el pedido'))
      .finally(() => setReopening(false))
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

  const unreadyCount = pendingItems.filter(i => !i.prepared).length
  const docBtn = 'flex items-center gap-1.5 text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors'

  return (
    <div className="mt-4 space-y-3">
      {blockedMsg && (
        <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Marca primero todos los artículos como listos (checkbox) antes de continuar
        </p>
      )}
      {reopenError && (
        <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {reopenError}
        </p>
      )}

      {/* Acción principal: pasar el pedido al siguiente estado */}
      {nextAction && (
        <button
          onClick={handleStatus}
          disabled={loading}
          title={needsPrepCheck && !allPrepared ? 'Faltan artículos por marcar como listos' : undefined}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl shadow-sm transition-colors disabled:opacity-50 ${
            needsPrepCheck && !allPrepared ? 'bg-gray-500 text-white' : nextAction.color
          }`}
        >
          {loading ? 'Actualizando...' : nextAction.label}
          {needsPrepCheck && !allPrepared && <span className="text-xs font-medium opacity-90">· faltan {unreadyCount} por marcar</span>}
        </button>
      )}

      {/* Restablecer pedido cancelado por error */}
      {canReopen && (
        <button
          onClick={handleReopen}
          disabled={reopening}
          className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          {reopening ? 'Restableciendo...' : 'Restablecer pedido'}
        </button>
      )}

      {/* Documentos y envío */}
      <div className="flex flex-wrap gap-2">
        {noteId ? (
          <Link
            href={`/albaranes/${noteId}`}
            className={`${docBtn} border-[#1E2B28] text-[#1E2B28] hover:bg-green-50`}
          >
            <FileText className="w-4 h-4" />
            {noteNumber ? `Albarán #${noteNumber}` : 'Ver albarán'}
          </Link>
        ) : (
          <button
            onClick={handleGenNote}
            disabled={loading}
            className={`${docBtn} border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40`}
          >
            <FileText className="w-4 h-4" />
            Generar albarán
          </button>
        )}
        {noteId && (
          <Link
            href={`/albaranes/${noteId}`}
            target="_blank"
            className={`${docBtn} border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </Link>
        )}
        <button
          onClick={shareWhatsApp}
          className={`${docBtn} border-green-300 text-green-700 hover:bg-green-50`}
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </button>
        <button
          onClick={exportCSV}
          className={`${docBtn} border-gray-300 text-gray-700 hover:bg-gray-50`}
        >
          <Download className="w-4 h-4" />
          Excel / CSV
        </button>
      </div>

      {/* Zona de cuidado: cancelar y eliminar, separadas del resto */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
        {canCancelOrder && (
          !confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className={`${docBtn} border-red-200 text-red-500 hover:bg-red-50`}
            >
              <Ban className="w-4 h-4" />
              Cancelar pedido
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 font-medium">¿Seguro?</span>
              <button
                onClick={handleCancelOrder}
                disabled={loading}
                className="text-sm font-semibold px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="text-sm font-medium px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Volver
              </button>
            </div>
          )
        )}

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className={`${docBtn} border-red-200 text-red-500 hover:bg-red-50 ml-auto`}
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        ) : (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-red-600 font-medium">¿Seguro?</span>
            <button
              onClick={() => { setLoading(true); onDeleted(order); deleteOrder(order.id) }}
              disabled={loading}
              className="text-sm font-semibold px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-sm font-medium px-3.5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Order card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, onDeleted, onStatusChange, onRectified, onItemCanceled, onPreparedChange, onLotChange, onWeightChange, onBoxExactUnitsChange, currentUserId,
}: {
  order: Order; onDeleted: (order: Order) => void
  onStatusChange: (id: string, status: OrderStatus) => void
  onRectified: (orderId: string, itemId: string, qty: number, note?: string) => void
  onItemCanceled: (orderId: string, itemId: string, reason?: string) => void
  onPreparedChange: (orderId: string, itemId: string, prepared: boolean) => void
  onLotChange: (orderId: string, itemId: string, lot: string) => void
  onWeightChange: (orderId: string, itemId: string, weight: number | null) => void
  onBoxExactUnitsChange: (orderId: string, itemId: string, exactUnits: number) => void
  currentUserId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const status = normalizeStatus(order.status)
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendiente
  const date = new Date(order.created_at)
  const returns = returnNotes(order).flatMap(n => n.delivery_note_items ?? [])

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      status === 'pendiente' ? 'border-yellow-200' : status === 'hecho' ? 'border-blue-200' : 'border-gray-100'
    }`}>
      {/* Header */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-10 h-10 bg-[#1E2B28] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">#{order.order_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-black truncate">{order.organizations?.name ?? 'Restaurante'}</p>
            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          {returns.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 mt-1">
              <Undo2 className="w-3 h-3" /> {returns.length} {returns.length === 1 ? 'devolución' : 'devoluciones'} recibida{returns.length === 1 ? '' : 's'}
            </span>
          )}
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-600">
              {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {', '}
              {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {order.order_items.length} producto{order.order_items.length !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold text-[#1E2B28] text-sm ml-auto">{Number(order.total_price).toFixed(2)}€</span>
          </div>
          {status === 'pendiente' && (() => {
            const live = order.order_items.filter(i => Number(i.rectified_quantity ?? -1) !== 0)
            if (live.length === 0) return null
            const done = live.filter(i => i.prepared).length
            return (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${(done / live.length) * 100}%` }} />
                </div>
                <span className="text-[11px] font-medium text-gray-600 shrink-0">Preparados {done}/{live.length}</span>
              </div>
            )
          })()}
          {order.notes && <p className="text-xs text-gray-600 italic mt-1 whitespace-pre-wrap break-words">"{order.notes}"</p>}
        </div>
        <div className="shrink-0 text-gray-600 mt-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded: items + actions */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3">
            {order.order_items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onRectified={(itemId, qty, note) => onRectified(order.id, itemId, qty, note)}
                onCanceled={(itemId, reason) => onItemCanceled(order.id, itemId, reason)}
                onPreparedChange={(itemId, prepared) => onPreparedChange(order.id, itemId, prepared)}
                onLotChange={(itemId, lot) => onLotChange(order.id, itemId, lot)}
                onWeightChange={(itemId, weight) => onWeightChange(order.id, itemId, weight)}
                onBoxExactUnitsChange={(itemId, exactUnits) => onBoxExactUnitsChange(order.id, itemId, exactUnits)}
              />
            ))}
          </div>
          {returns.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <Undo2 className="w-3.5 h-3.5" /> Devoluciones recibidas
              </p>
              {returns.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-black">{r.products?.name ?? '—'}: {Number(r.delivered_quantity)}</span>
                  <span className={r.return_reason === 'reutilizable' ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                    {r.return_reason === 'reutilizable' ? '↩ Repuesto a stock' : '🚫 No reutilizable'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <OrderActions order={order} onDeleted={onDeleted} onStatusChange={onStatusChange} />
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> Chat con {order.organizations?.name ?? 'el restaurante'}
            </p>
            <OrderChat orderId={order.id} currentUserId={currentUserId} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

type DateFilter = 'hoy' | 'semana' | 'mes' | 'custom'
type StatusFilter = 'todos' | 'pendiente' | 'hecho' | 'enviado'

export function PedidosNaveClient({ orders: initialOrders, deletedOrders: initialDeletedOrders, restaurants, currentUserId }: { orders: Order[]; deletedOrders: Order[]; restaurants: Restaurant[]; currentUserId: string }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [deletedOrders, setDeletedOrders] = useState<Order[]>(initialDeletedOrders)
  const [showTrash, setShowTrash] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoy')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [restFilter, setRestFilter] = useState('todos')

  function handleDeleted(order: Order) {
    setOrders(prev => prev.filter(o => o.id !== order.id))
    setDeletedOrders(prev => [{ ...order, deleted_at: new Date().toISOString(), deleted_by_profile: null }, ...prev])
  }

  function handleRestore(order: Order) {
    setDeletedOrders(prev => prev.filter(o => o.id !== order.id))
    setOrders(prev => [{ ...order, deleted_at: null, deleted_by_profile: null }, ...prev])
    restoreOrder(order.id).catch(() => {
      // Si falla, deshacer el cambio optimista: vuelve a la papelera.
      setOrders(prev => prev.filter(o => o.id !== order.id))
      setDeletedOrders(prev => [order, ...prev])
    })
  }
  function handleStatusChange(id: string, status: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }
  function handleRectified(orderId: string, itemId: string, qty: number, note?: string) {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const items = o.order_items.map(it => it.id === itemId
        ? { ...it, rectified_quantity: qty, total_price: qty * Number(it.unit_price), rectification_note: note ?? null }
        : it)
      const total_price = items.reduce((s, it) => s + Number(it.rectified_quantity ?? it.quantity) * Number(it.unit_price), 0)
      return { ...o, order_items: items, total_price }
    }))
  }
  function handleItemCanceled(orderId: string, itemId: string, reason?: string) {
    handleRectified(orderId, itemId, 0, reason)
  }
  function handlePreparedChange(orderId: string, itemId: string, prepared: boolean) {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o, order_items: o.order_items.map(it => it.id === itemId ? { ...it, prepared } : it),
    }))
  }
  function handleLotChange(orderId: string, itemId: string, lot: string) {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o, order_items: o.order_items.map(it => it.id === itemId ? { ...it, lot_number: lot } : it),
    }))
  }
  function handleWeightChange(orderId: string, itemId: string, weight: number | null) {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o, order_items: o.order_items.map(it => it.id === itemId ? { ...it, actual_weight: weight } : it),
    }))
  }
  function handleBoxExactUnitsChange(orderId: string, itemId: string, exactUnits: number) {
    setOrders(prev => prev.map(o => o.id !== orderId ? o : {
      ...o, order_items: o.order_items.map(it => {
        if (it.id !== itemId) return it
        const boxCount = it.box_count ?? 1
        return { ...it, box_exact_units: exactUnits, rectified_quantity: boxCount * exactUnits }
      }),
    }))
  }
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

  const counts = useMemo(() => {
    const acc = { pendiente: 0, hecho: 0, enviado: 0 }
    for (const o of orders) {
      const s = normalizeStatus(o.status)
      if (s in acc) acc[s as keyof typeof acc]++
    }
    return acc
  }, [orders])

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Title */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-black">Pedidos entrantes</h1>
          <p className="text-gray-700 text-sm mt-1 capitalize">{todayLabel}</p>
        </div>
        <button
          onClick={() => setShowTrash(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors shrink-0 ${
            showTrash ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminados ({deletedOrders.length})
        </button>
      </div>

      {showTrash && (
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-black">Pedidos eliminados</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimos 90 días · se puede restaurar un pedido eliminado por error</p>
          </div>
          {deletedOrders.length === 0 ? (
            <p className="text-center py-10 text-gray-600 text-sm">No hay pedidos eliminados</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {deletedOrders.map(o => (
                <div key={o.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-black text-sm">
                      #{o.order_number} · {o.organizations?.name ?? 'Desconocido'} · {o.total_price.toFixed(2)}€
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {o.order_items?.length ?? 0} producto{(o.order_items?.length ?? 0) !== 1 ? 's' : ''} · pedido el {new Date(o.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </p>
                    {o.deleted_at && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Eliminado el {new Date(o.deleted_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a las {new Date(o.deleted_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        {o.deleted_by_profile?.full_name ? ` por ${o.deleted_by_profile.full_name}` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(o)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#1E2B28] text-white hover:bg-[#141F1C] transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${c.color} ${statusFilter === c.key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}
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
                dateFilter === k ? 'bg-[#1E2B28] text-white' : 'text-gray-700 hover:bg-gray-50'
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
              <label className="text-xs text-gray-600 block mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-600 block mb-1">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
          </div>
        )}

        {/* Restaurant + status filters */}
        <div className="flex flex-wrap gap-3 p-4">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-600 block mb-1">Restaurante</label>
            <div className="relative">
              <select
                value={restFilter}
                onChange={e => setRestFilter(e.target.value)}
                className="w-full border border-[#1E2B28]/25 bg-[#1E2B28]/10 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] appearance-none pr-8"
              >
                <option value="todos">Todos los restaurantes</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-600 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-600 block mb-1">Estado</label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full border border-[#1E2B28]/25 bg-[#1E2B28]/10 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] appearance-none pr-8"
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="hecho">Hecho</option>
                <option value="enviado">Enviado</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-600 absolute right-2.5 top-2.5 pointer-events-none" />
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
            {pastPending.map(o => <OrderCard key={o.id} order={o} onDeleted={handleDeleted} onStatusChange={handleStatusChange} onRectified={handleRectified} onItemCanceled={handleItemCanceled} onPreparedChange={handlePreparedChange} onLotChange={handleLotChange} onWeightChange={handleWeightChange} onBoxExactUnitsChange={handleBoxExactUnitsChange} currentUserId={currentUserId} />)}
          </div>
        </section>
      )}

      {/* Today's orders / filtered orders */}
      <section>
        {dateFilter === 'hoy' && (
          <h2 className="text-sm font-semibold text-black flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#1E2B28]" />
            Pedidos de hoy ({todayOrders.length})
          </h2>
        )}
        {todayOrders.length === 0 && pastPending.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-medium">No hay pedidos para este período</p>
            {dateFilter === 'hoy' && <p className="text-sm mt-1">Los pedidos de hoy aparecerán aquí cuando lleguen</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {todayOrders.map(o => <OrderCard key={o.id} order={o} onDeleted={handleDeleted} onStatusChange={handleStatusChange} onRectified={handleRectified} onItemCanceled={handleItemCanceled} onPreparedChange={handlePreparedChange} onLotChange={handleLotChange} onWeightChange={handleWeightChange} onBoxExactUnitsChange={handleBoxExactUnitsChange} currentUserId={currentUserId} />)}
          </div>
        )}
      </section>
    </div>
  )
}
