'use client'

import { useMemo, useState } from 'react'
import { X, Search, Check, Minus, Plus, ChevronRight, ThumbsUp, AlertTriangle, ArrowLeft } from 'lucide-react'
import { createReturn, type ReturnReason } from '@/app/actions/orders'
import { unitLabel } from '@/lib/units'
import { cn } from '@/lib/utils'

export type ReturnLine = {
  orderId: string
  orderNumber: number
  createdAt: string
  productId: string
  productName: string
  unit: string
  unitPrice: number
  lotNumber: string | null
  remaining: number
}

type Props = {
  lines: ReturnLine[]
  preset?: { orderId: string; productId: string } | null
  onClose: () => void
  onReturned: (orderId: string, productId: string, qty: number, reason: ReturnReason) => void
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
}

export function ReturnSheet({ lines, preset, onClose, onReturned }: Props) {
  const initial = preset ? lines.find(l => l.orderId === preset.orderId && l.productId === preset.productId) ?? null : null
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReturnLine | null>(initial)
  const [qty, setQty] = useState(initial ? fmt(initial.remaining) : '')
  const [reason, setReason] = useState<ReturnReason | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ name: string; qty: number; unit: string } | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? lines.filter(l => l.productName.toLowerCase().includes(q)) : lines
    return list.slice(0, 40)
  }, [lines, query])

  function pick(line: ReturnLine) {
    setSelected(line)
    setQty(fmt(line.remaining))
    setReason(null)
    setError(null)
  }

  function back() {
    setSelected(null)
    setReason(null)
    setError(null)
  }

  const step = selected && !Number.isInteger(selected.remaining) ? 0.5 : 1
  const qtyNum = parseFloat(qty.replace(',', '.'))
  const qtyValid = selected != null && !isNaN(qtyNum) && qtyNum > 0 && qtyNum <= selected.remaining

  function adjust(delta: number) {
    if (!selected) return
    const base = isNaN(qtyNum) ? 0 : qtyNum
    const next = Math.min(selected.remaining, Math.max(step, Math.round((base + delta) * 1000) / 1000))
    setQty(fmt(next))
  }

  async function confirm() {
    if (!selected || !reason || !qtyValid) return
    setPending(true)
    setError(null)
    onReturned(selected.orderId, selected.productId, qtyNum, reason)
    try {
      await createReturn(selected.orderId, [{
        product_id: selected.productId, quantity: qtyNum, unit: selected.unit,
        unit_price: selected.unitPrice, reason, lot_number: selected.lotNumber,
      }])
      setDone({ name: selected.productName, qty: qtyNum, unit: selected.unit })
      setSelected(null)
      setReason(null)
      setQuery('')
    } catch (e: any) {
      onReturned(selected.orderId, selected.productId, -qtyNum, reason)
      setError(e?.message ?? 'No se pudo registrar la devolución, inténtalo de nuevo')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          {selected && (
            <button onClick={back} className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Volver">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="flex-1 font-bold text-black text-lg">Devolver un producto</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {done ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="font-bold text-black text-lg">Devolución registrada</p>
                <p className="text-sm text-gray-600 mt-1">{fmt(done.qty)} {unitLabel(done.unit)} de {done.name}</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={() => setDone(null)} className="w-full py-3 rounded-xl bg-[#1E2B28] text-white font-semibold">
                  Devolver otro producto
                </button>
                <button onClick={onClose} className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-medium">
                  Terminar
                </button>
              </div>
            </div>
          ) : !selected ? (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="¿Qué producto quieres devolver?"
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                />
              </div>
              {lines.length === 0 ? (
                <p className="text-center text-sm text-gray-600 py-8">No hay productos entregados que se puedan devolver.</p>
              ) : results.length === 0 ? (
                <p className="text-center text-sm text-gray-600 py-8">Ningún producto coincide con «{query}»</p>
              ) : (
                <div className="divide-y divide-gray-100 -mx-1">
                  {results.map(l => (
                    <button
                      key={l.orderId + l.productId}
                      onClick={() => pick(l)}
                      className="w-full flex items-center gap-3 px-1 py-3 text-left hover:bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-black text-sm leading-tight">{l.productName}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Pedido #{l.orderNumber} · {new Date(l.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {fmt(l.remaining)} {unitLabel(l.unit)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-5">
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="font-semibold text-black leading-tight">{selected.productName}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Pedido #{selected.orderNumber} · se puede devolver hasta {fmt(selected.remaining)} {unitLabel(selected.unit)}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-black mb-2">¿Cuánto devuelves?</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => adjust(-step)} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95" aria-label="Menos">
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    inputMode="decimal"
                    className={cn(
                      'flex-1 min-w-0 text-center text-2xl font-bold py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#1E2B28]',
                      qty !== '' && !qtyValid ? 'border-red-300 text-red-600' : 'border-gray-200'
                    )}
                  />
                  <button onClick={() => adjust(step)} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95" aria-label="Más">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600">{unitLabel(selected.unit)}</span>
                  {qtyNum !== selected.remaining && (
                    <button onClick={() => setQty(fmt(selected.remaining))} className="text-xs font-semibold text-[#1E2B28] underline">
                      Devolver todo ({fmt(selected.remaining)})
                    </button>
                  )}
                </div>
                {qty !== '' && !qtyValid && (
                  <p className="text-xs text-red-600 mt-1">Pon una cantidad entre 0 y {fmt(selected.remaining)}</p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-black mb-2">¿Por qué lo devuelves?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReason('reutilizable')}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-colors',
                      reason === 'reutilizable' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <ThumbsUp className={cn('w-5 h-5 mb-1.5', reason === 'reutilizable' ? 'text-green-600' : 'text-gray-500')} />
                    <p className="text-sm font-semibold text-black leading-tight">Error de pedido o no lo necesito</p>
                    <p className="text-[11px] text-gray-600 mt-1">Vuelve al stock de la nave</p>
                  </button>
                  <button
                    onClick={() => setReason('no_utilizable')}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-colors',
                      reason === 'no_utilizable' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <AlertTriangle className={cn('w-5 h-5 mb-1.5', reason === 'no_utilizable' ? 'text-red-500' : 'text-gray-500')} />
                    <p className="text-sm font-semibold text-black leading-tight">Mal estado o no se puede usar</p>
                    <p className="text-[11px] text-gray-600 mt-1">No vuelve al stock</p>
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

              <button
                onClick={confirm}
                disabled={!reason || !qtyValid || pending}
                className="w-full py-3.5 rounded-xl bg-[#1E2B28] text-white font-semibold disabled:opacity-40 transition-opacity"
              >
                {pending ? 'Registrando…' : 'Confirmar devolución'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
