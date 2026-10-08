'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function WorkersModal({ workers, onClose, onAdd, onRemove }: { workers: { id: string; name: string }[]; onClose: () => void; onAdd: (name: string) => void; onRemove: (id: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 flex flex-col">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-xl font-bold text-black">Trabajadores de producción</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) { onAdd(name); setName('') } }} className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre (como quieres que salga)" className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-base focus:outline-none focus:border-[#1E2B28]" />
          <button type="submit" className="rounded-xl bg-[#1E2B28] text-white font-semibold px-4 flex items-center gap-1.5"><Plus className="w-5 h-5" /> Añadir</button>
        </form>
        <div className="overflow-y-auto space-y-2">
          {workers.map(w => (
            <div key={w.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
              <span className="flex-1 font-semibold text-black">{w.name}</span>
              <button onClick={() => onRemove(w.id)} className="text-sm text-red-600 font-medium">Quitar</button>
            </div>
          ))}
          {workers.length === 0 && <p className="text-sm text-gray-600 text-center py-4">Todavía no hay nadie.</p>}
        </div>
        <p className="text-xs text-gray-500">Usa solo el nombre de pila o un apodo. Aquí no se ven sueldos ni precios.</p>
      </div>
    </div>
  )
}
