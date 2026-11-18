'use client'

import { useState, useMemo, useTransition, useEffect, useSyncExternalStore } from 'react'
import { applyStockCount } from '@/app/actions/stockCount'
import { X, ClipboardList, ArrowRight, ArrowLeft, Check, Search, WifiOff } from 'lucide-react'

// El recuento en curso se guarda en la propia tablet (no en internet) a cada cifra que se escribe, para que
// no se pierda si dentro del congelador se corta la conexión, se recarga la página o se cierra la ventana.
const DRAFT_KEY = 'proveo.stockcount.draft'
const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
type Draft = { counts: Record<string, string>; category: string; savedAt: number }

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    if (!d || typeof d.counts !== 'object' || Date.now() - Number(d.savedAt) > DRAFT_MAX_AGE_MS) return null
    const counts = Object.fromEntries(Object.entries(d.counts).filter(([, v]) => typeof v === 'string' && v.trim() !== ''))
    return Object.keys(counts).length > 0 ? { counts, category: typeof d.category === 'string' ? d.category : 'todas', savedAt: d.savedAt } : null
  } catch { return null }
}
function writeDraft(d: Draft | null) {
  try { if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY) } catch { /* sin almacenamiento */ }
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb); window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

type InventoryRow = {
  product_id: string; product_name: string; product_unit: string
  category_id: string | null; category_name: string | null
  current_stock: number
}
type Category = { id: string; name: string; color: string | null }

// Recuento: no se muestra el stock que dice el sistema, solo la diferencia
// (contado − sistema) junto a cada cantidad en cuanto se escribe. Antes de
// aplicar nada hay una pantalla de revisión, así se puede cancelar si algo no
// cuadra en vez de corregir a ciegas como con la edición normal de stock.
export function StockCountFlow({ rows, categories, onClose, onApplied }: {
  rows: InventoryRow[]; categories: Category[]; onClose: () => void; onApplied: () => void
}) {
  // Si había un recuento sin terminar guardado en la tablet, se recupera y se sigue por donde iba
  const [draft] = useState<Draft | null>(readDraft)
  const [recovered, setRecovered] = useState(!!draft)
  const online = useOnline()
  const [step, setStep] = useState<'setup' | 'count' | 'review' | 'done'>(draft ? 'count' : 'setup')
  const [categoryFilter, setCategoryFilter] = useState<string>(draft?.category ?? 'todas')
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>(draft?.counts ?? {})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)

  const scopedRows = useMemo(() => {
    return rows.filter(r => categoryFilter === 'todas' || r.category_id === categoryFilter)
  }, [rows, categoryFilter])

  const visibleRows = useMemo(() => {
    if (!search.trim()) return scopedRows
    const q = search.toLowerCase()
    return scopedRows.filter(r => r.product_name.toLowerCase().includes(q))
  }, [scopedRows, search])

  // Guardado automático en la tablet a cada cambio (no se pierde aunque no haya internet). Al aplicar se borra.
  useEffect(() => {
    if (step === 'done') return
    const filled = Object.fromEntries(Object.entries(counts).filter(([, v]) => v.trim() !== ''))
    writeDraft(Object.keys(filled).length > 0 ? { counts: filled, category: categoryFilter, savedAt: Date.now() } : null)
  }, [counts, categoryFilter, step])

  function discardDraft() {
    setCounts({}); setRecovered(false); writeDraft(null)
  }

  const countedIds = Object.keys(counts).filter(id => counts[id].trim() !== '')
  const diffs = useMemo(() => {
    return countedIds
      .map(id => {
        const row = rows.find(r => r.product_id === id)
        if (!row) return null
        const counted = parseFloat(counts[id].replace(',', '.'))
        if (isNaN(counted)) return null
        return { row, counted, delta: counted - row.current_stock }
      })
      .filter((d): d is { row: InventoryRow; counted: number; delta: number } => d !== null)
  }, [countedIds, counts, rows])

  function confirmApply() {
    setError(null)
    startTransition(async () => {
      try {
        const { applied } = await applyStockCount(diffs.map(d => ({ productId: d.row.product_id, countedQty: d.counted })))
        setAppliedCount(applied)
        writeDraft(null)
        setStep('done')
        onApplied()
      } catch {
        setError(typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Sin conexión: el recuento NO se ha aplicado todavía. Tus cantidades siguen guardadas en esta tablet; cuando tengas internet, vuelve a pulsar «Confirmar y aplicar».'
          : 'No se pudo aplicar el recuento. Tus cantidades siguen guardadas en esta tablet; inténtalo de nuevo.')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-black flex items-center gap-2">
            <ClipboardList className="w-4.5 h-4.5" />
            Recuento físico
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {step === 'setup' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700">
              Cuenta lo que tienes en el almacén sin ver lo que dice el sistema — al final verás las diferencias antes de aplicar nada.
            </p>
            <div>
              <label className="text-xs text-gray-600 block mb-1">¿Qué quieres contar?</label>
              <select
                value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
              >
                <option value="todas">Todos los productos ({rows.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({rows.filter(r => r.category_id === c.id).length})</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setStep('count')}
              className="w-full flex items-center justify-center gap-2 bg-[#1E2B28] text-white font-semibold py-3 rounded-xl hover:bg-[#141F1C] transition-colors"
            >
              Empezar recuento <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'count' && (
          <>
            <div className="px-6 pt-4 pb-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..."
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
                />
              </div>
              <p className="text-xs text-gray-600">
                {countedIds.length}/{scopedRows.length} contados — deja en blanco lo que no cuentes ahora
                {countedIds.length > 0 && <span className="text-green-700"> · guardado en la tablet</span>}
              </p>
              {!online && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  Sin conexión: sigue contando, lo que escribas queda guardado en la tablet. Cuando vuelva internet, pulsa «Revisar diferencias».
                </p>
              )}
              {recovered && countedIds.length > 0 && (
                <p className="flex items-center justify-between gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                  <span>Recuento recuperado: {countedIds.length} producto{countedIds.length !== 1 ? 's' : ''} ya contado{countedIds.length !== 1 ? 's' : ''}.</span>
                  <button type="button" onClick={discardDraft} className="font-semibold underline shrink-0">Empezar de cero</button>
                </p>
              )}
            </div>
            <div className="max-h-[26rem] overflow-y-auto divide-y divide-gray-50">
              {visibleRows.map(row => {
                // Diferencia contada − sistema, en cuanto se escribe la cantidad (sin mostrar el stock del sistema)
                const raw = counts[row.product_id]?.trim() ?? ''
                const counted = raw === '' ? NaN : parseFloat(raw.replace(',', '.'))
                const delta = Number.isNaN(counted) ? null : Math.round((counted - row.current_stock) * 1000) / 1000
                return (
                  <div key={row.product_id} className="flex items-center gap-3 px-4 sm:px-6 py-2.5">
                    <span className="flex-1 min-w-0 text-sm text-black leading-tight sm:truncate">{row.product_name}</span>
                    <input
                      type="number" step="0.001" min="0" placeholder="—"
                      value={counts[row.product_id] ?? ''}
                      onChange={e => setCounts(prev => ({ ...prev, [row.product_id]: e.target.value }))}
                      className={`w-24 shrink-0 border rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1E2B28] ${
                        raw !== '' ? 'border-[#1E2B28] bg-[#1E2B28]/5' : 'border-gray-200'
                      }`}
                    />
                    <span className="text-xs text-gray-600 w-9 sm:w-10 shrink-0">{row.product_unit}</span>
                    <span
                      className={`w-16 sm:w-24 shrink-0 text-right text-xs sm:text-sm font-semibold tabular-nums ${
                        delta === null ? '' : delta === 0 ? 'text-gray-600' : delta > 0 ? 'text-green-600' : 'text-red-500'
                      }`}
                      title={delta === null ? undefined : delta === 0 ? 'Coincide con el sistema' : 'Diferencia con el sistema'}
                    >
                      {delta === null ? '' : delta === 0 ? '✓ coincide' : `${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')}`}
                    </span>
                  </div>
                )
              })}
              {visibleRows.length === 0 && <p className="text-center py-8 text-gray-600 text-sm">Sin productos</p>}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <button onClick={() => setStep('setup')} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={countedIds.length === 0}
                className="flex items-center gap-2 bg-[#1E2B28] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#141F1C] disabled:opacity-40 transition-colors"
              >
                Revisar diferencias ({countedIds.length}) <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="max-h-[26rem] overflow-y-auto divide-y divide-gray-50">
              {diffs.length === 0 ? (
                <p className="text-center py-10 text-gray-600 text-sm">Ningún valor válido para aplicar</p>
              ) : diffs.every(d => d.delta === 0) ? (
                <p className="text-center py-10 text-gray-600 text-sm">Todo coincide con el sistema — nada que ajustar</p>
              ) : (
                diffs.filter(d => d.delta !== 0).map(d => (
                  <div key={d.row.product_id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black truncate">{d.row.product_name}</p>
                      <p className="text-xs text-gray-600">Sistema: {d.row.current_stock} {d.row.product_unit} · Contado: {d.counted} {d.row.product_unit}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${d.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {d.delta > 0 ? '+' : ''}{d.delta.toFixed(3).replace(/\.?0+$/, '')} {d.row.product_unit}
                    </span>
                  </div>
                ))
              )}
            </div>
            {error && <p className="px-6 text-xs text-red-500 pb-2">{error}</p>}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <button onClick={() => setStep('count')} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black">
                <ArrowLeft className="w-4 h-4" /> Seguir contando
              </button>
              <button
                onClick={confirmApply}
                disabled={pending || diffs.filter(d => d.delta !== 0).length === 0}
                className="flex items-center gap-2 bg-[#A8793A] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#8C6430] disabled:opacity-40 transition-colors"
              >
                {pending ? 'Aplicando...' : 'Confirmar y aplicar'} <Check className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-black">Recuento aplicado</p>
            <p className="text-sm text-gray-600">{appliedCount} producto{appliedCount !== 1 ? 's' : ''} actualizado{appliedCount !== 1 ? 's' : ''}</p>
            <button onClick={onClose} className="mt-2 bg-[#1E2B28] text-white font-medium px-5 py-2.5 rounded-xl hover:bg-[#141F1C] transition-colors">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
