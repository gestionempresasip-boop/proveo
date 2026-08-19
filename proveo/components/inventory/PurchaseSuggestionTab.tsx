'use client'

import { useEffect, useState } from 'react'
import { getPurchaseSuggestions, type PurchaseSuggestion } from '@/app/actions/purchaseSuggestions'
import { TrendingDown, RefreshCw, ShoppingCart } from 'lucide-react'

function coverageColor(days: number | null) {
  if (days == null) return 'text-gray-600'
  if (days <= 3) return 'text-red-600'
  if (days <= 7) return 'text-amber-600'
  return 'text-green-600'
}

export function PurchaseSuggestionTab() {
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[] | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    getPurchaseSuggestions().then(data => { setSuggestions(data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const urgent = (suggestions ?? []).filter(s => (s.daysOfCoverage ?? Infinity) <= 7).length

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-black">Sugerencia de compra</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Basado en el consumo real de los últimos 30 días · objetivo: cubrir 14 días de stock
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Recalcular
        </button>
      </div>

      {urgent > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            {urgent} producto{urgent !== 1 ? 's' : ''} con menos de 7 días de cobertura al ritmo actual
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-gray-600 text-sm">Calculando...</p>
      ) : !suggestions || suggestions.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p>Sin consumo suficiente en los últimos 30 días para calcular sugerencias</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {suggestions.map(s => (
              <div key={s.productId} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black truncate">{s.productName}</p>
                  <p className="text-xs text-gray-600">
                    Consumo medio: {s.avgDailyConsumption.toFixed(2)} {s.unit}/día · Stock actual: {s.currentStock} {s.unit}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold ${coverageColor(s.daysOfCoverage)}`}>
                    {s.daysOfCoverage != null ? `${s.daysOfCoverage.toFixed(1)} días` : '—'}
                  </p>
                  {s.suggestedQty > 0 && (
                    <p className="text-xs text-gray-600">Reponer ≈{s.suggestedQty} {s.unit}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
