'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ProductionState } from '@/app/actions/production'

export function ProductPicker({ products, onClose, onPick }: { products: ProductionState['products']; onClose: () => void; onPick: (p: ProductionState['products'][number]) => void }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) {
      const frequent = products.filter(p => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 12)
      return frequent.length > 0 ? frequent : products.filter(p => p.category === 'Elaboraciones nave').slice(0, 30)
    }
    return products.filter(p => p.name.toLowerCase().includes(s)).slice(0, 40)
  }, [products, q])
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <h2 className="flex-1 text-xl font-bold text-black">¿Qué vas a producir?</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-4 pb-2 relative">
          <Search className="absolute left-7 top-1/2 -translate-y-[calc(50%-4px)] w-5 h-5 text-gray-400" />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Busca el producto…" className="w-full rounded-xl border-2 border-gray-200 pl-11 pr-4 py-4 text-lg focus:outline-none focus:border-[#1E2B28]" />
        </div>
        <p className="px-5 text-xs text-gray-500">{q ? 'Resultados' : 'Los que más haces'}</p>
        <div className="overflow-y-auto p-4 pt-2 grid grid-cols-1 gap-2">
          {list.map(p => (
            <button key={p.id} onClick={() => onPick(p)} className="text-left rounded-xl border-2 border-gray-200 hover:border-[#1E2B28] active:bg-green-50 px-4 py-4">
              <span className="block text-lg font-bold text-black leading-tight">{p.name}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{p.category ?? ''}{p.runs > 0 ? ` · ${p.runs} tanda${p.runs !== 1 ? 's' : ''}` : ''}</span>
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-gray-600 py-8">No hay ningún producto con ese nombre.</p>}
        </div>
      </div>
    </div>
  )
}
