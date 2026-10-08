'use client'

import { UserPlus } from 'lucide-react'

export function WorkerPicker({ workers, onPick, onManage }: { workers: { id: string; name: string }[]; onPick: (id: string) => void; onManage: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-black">¿Quién eres?</h2>
      {workers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center space-y-3">
          <p className="text-gray-700">Todavía no hay ningún trabajador. Añade los nombres de quienes trabajan en producción.</p>
          <button onClick={onManage} className="inline-flex items-center gap-2 rounded-xl bg-[#1E2B28] text-white font-semibold px-5 py-3"><UserPlus className="w-5 h-5" /> Añadir trabajadores</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {workers.map(w => (
              <button key={w.id} onClick={() => onPick(w.id)} className="rounded-2xl bg-white border-2 border-gray-200 hover:border-[#1E2B28] active:bg-green-50 text-xl font-bold text-black py-8 px-3">{w.name}</button>
            ))}
          </div>
          <button onClick={onManage} className="text-sm text-gray-600 underline">Añadir o quitar trabajadores</button>
        </>
      )}
    </div>
  )
}
