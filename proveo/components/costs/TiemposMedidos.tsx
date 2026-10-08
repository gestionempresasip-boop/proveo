'use client'

import { useState } from 'react'
import { Timer } from 'lucide-react'
import { applyMeasuredToSheet, type MeasuredProduct } from '@/app/actions/production'
import { fmtDuration } from '@/lib/productionTime'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'

export function TiemposMedidos({ measured, onSeeRuns }: { measured: MeasuredProduct[]; onSeeRuns: (name: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function apply(m: MeasuredProduct) {
    setBusy(m.product_id); setMsg(null)
    try {
      const r = await applyMeasuredToSheet(m.product_id)
      setMsg({ ok: true, text: `${m.name}: ${r.created ? 'ficha creada' : 'ficha actualizada'} con ${m.suggested.people} persona(s) × ${m.suggested.minutes} min y ${m.suggested.yield_qty} unidades por tanda. Recargando…` })
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) { setMsg({ ok: false, text: errorMessage(e, 'No se pudo aplicar') }); setBusy(null) }
  }

  if (measured.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 text-center py-14 px-6 text-gray-600">
        <Timer className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-black">Todavía no hay tandas medidas</p>
        <p className="text-sm mt-1">Cuando el equipo termine producciones en la pestaña <strong>Producción</strong>, aquí verás cuánto tardan de verdad y podrás pasarlo a las fichas.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">Medianas de las últimas 10 tandas terminadas de cada producto. Con 3 o más tandas el dato es fiable. Si alguna fue una prueba, bórrala desde <strong>Ver y borrar tandas</strong>: así no cuenta como tiempo definitivo.</p>
      {msg && <p className={cn('text-sm rounded-xl px-3.5 py-3', msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>{msg.text}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {measured.map(m => (
          <div key={m.product_id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold text-black">{m.name}</p>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0', m.runs >= 3 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200')}>{m.runs} tanda{m.runs !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Sale por tanda</p><p className="font-bold">{m.unitsPerRun.toLocaleString('es-ES')} uds</p></div>
              <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Trabajo (persona·min)</p><p className="font-bold">{fmtDuration(m.personMinutes)}</p></div>
              <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Tiempo hasta terminado</p><p className="font-bold">{fmtDuration(m.leadMinutes)}</p></div>
              <div className="rounded-lg bg-gray-50 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">De ello, esperas</p><p className="font-bold">{fmtDuration(m.waitingMinutes)}</p></div>
            </div>
            <div className="space-y-1">
              {m.stages.map(s => (
                <div key={s.stage} className="flex items-center justify-between text-xs">
                  <span className={cn('text-gray-700', s.kind === 'espera' && 'italic text-amber-800')}>{s.stage}{s.kind === 'espera' ? ' (sin personal)' : s.kind === 'pausa' ? ' (no cuenta)' : ''}</span>
                  <span className="tabular-nums font-medium">{fmtDuration(s.minutes)}</span>
                </div>
              ))}
            </div>
            <button onClick={() => onSeeRuns(m.name)} className="w-full rounded-xl border-2 border-gray-300 text-gray-800 text-sm font-semibold py-2.5 hover:bg-gray-50">Ver y borrar tandas de este producto ({m.runs})</button>
            <button onClick={() => apply(m)} disabled={busy !== null} className="w-full rounded-xl bg-[#A8793A] text-white text-sm font-semibold py-2.5 hover:bg-[#8F6630] disabled:opacity-50">
              {busy === m.product_id ? 'Aplicando…' : `Pasar a la ficha: ${m.suggested.people} persona(s) × ${m.suggested.minutes} min`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
