'use client'

import { useState, useMemo, useTransition } from 'react'
import { applyStockCount } from '@/app/actions/stockCount'
import { X, ClipboardList, ArrowRight, ArrowLeft, Check, Search } from 'lucide-react'

type InventoryRow = {
  product_id: string; product_name: string; product_unit: string
  category_id: string | null; category_name: string | null
  current_stock: number
}
type Category = { id: string; name: string; color: string | null }

// Recuento "ciego": no se ve el stock que dice el sistema mientras se
// cuenta, para no sesgar el conteo hacia lo que "debería" salir. La
// diferencia solo se muestra en la pantalla de revisión, antes de aplicar
// nada — así se puede cancelar si algo no cuadra en vez de corregir a
// ciegas como con la edición normal de stock.
export function StockCountFlow({ rows, categories, onClose, onApplied }: {
  rows: InventoryRow[]; categories: Category[]; onClose: () => void; onApplied: () => void
}) {
  const [step, setStep] = useState<'setup' | 'count' | 'review' | 'done'>('setup')
  const [categoryFilter, setCategoryFilter] = useState<string>('todas')
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>({})
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
        setStep('done')
        onApplied()
      } catch {
        setError('No se pudo aplicar el recuento, inténtalo de nuevo')
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
              <p className="text-xs text-gray-600">{countedIds.length}/{scopedRows.length} contados — deja en blanco lo que no cuentes ahora</p>
            </div>
            <div className="max-h-[26rem] overflow-y-auto divide-y divide-gray-50">
              {visibleRows.map(row => (
                <div key={row.product_id} className="flex items-center gap-3 px-6 py-2.5">
                  <span className="flex-1 min-w-0 text-sm text-black truncate">{row.product_name}</span>
                  <input
                    type="number" step="0.001" min="0" placeholder="—"
                    value={counts[row.product_id] ?? ''}
                    onChange={e => setCounts(prev => ({ ...prev, [row.product_id]: e.target.value }))}
                    className={`w-24 border rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1E2B28] ${
                      counts[row.product_id]?.trim() ? 'border-[#1E2B28] bg-[#1E2B28]/5' : 'border-gray-200'
                    }`}
                  />
                  <span className="text-xs text-gray-600 w-10 shrink-0">{row.product_unit}</span>
                </div>
              ))}
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
