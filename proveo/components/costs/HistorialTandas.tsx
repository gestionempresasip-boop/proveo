'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Timer, Trash2 } from 'lucide-react'
import { deleteRun, type RunHistoryItem } from '@/app/actions/production'
import { fmtDuration } from '@/lib/productionTime'
import { cn } from '@/lib/utils'
import { field } from './ui'
import { Pager, usePaged } from '@/components/ui/Pager'

export function HistorialTandas({ history, filter, onFilter }: { history: RunHistoryItem[]; filter: string; onFilter: (v: string) => void }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState(history)
  const [msg, setMsg] = useState<string | null>(null)

  async function remove(id: string) {
    setBusy(true)
    try {
      await deleteRun(id)
      setItems(prev => prev.filter(x => x.id !== id))
      setConfirm(null)
      setMsg('Tanda borrada: ya no cuenta en las medias.')
      router.refresh() // recalcula «Tiempos medidos» sin esa tanda
      setTimeout(() => setMsg(null), 3500)
    } finally { setBusy(false) }
  }
  const shown = filter.trim() ? items.filter(h => h.product_name.toLowerCase().includes(filter.trim().toLowerCase())) : items

  const paged = usePaged(shown, filter.trim().toLowerCase())

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 text-center py-14 px-6 text-gray-600">
        <Timer className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-black">Todavía no hay tandas terminadas</p>
        <p className="text-sm mt-1">Cada vez que el equipo termine una producción en la pestaña <strong>Producción</strong>, quedará guardada aquí con todos sus tiempos.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">Las últimas {items.length} tandas terminadas. <strong>Todas cuentan para las medias</strong>: borra con la papelera las que sean pruebas o errores.</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
        <input value={filter} onChange={e => onFilter(e.target.value)} placeholder="Filtrar por producto…" className={cn(field, 'pl-9')} />
      </div>
      {msg && <p className="text-sm rounded-xl bg-green-50 border border-green-200 text-green-800 px-3.5 py-2.5">{msg}</p>}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {shown.length === 0 && <p className="px-4 py-8 text-center text-gray-600 text-sm">No hay tandas con ese producto.</p>}
        {paged.pageItems.map(h => {
          const d = new Date(h.started_at)
          return (
            <div key={h.id}>
              {confirm === h.id && (
                <div className="flex flex-wrap items-center gap-2 text-sm bg-red-50 px-4 py-3">
                  <span className="flex-1 min-w-[200px] text-red-800 font-medium">¿Borrar «{h.product_name}» ({d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})? Dejará de contar.</span>
                  <button disabled={busy} onClick={() => remove(h.id)} className="px-3.5 py-2 rounded-lg bg-red-600 text-white font-semibold">Sí, borrar</button>
                  <button onClick={() => setConfirm(null)} className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white">No</button>
                </div>
              )}
              <div className="flex items-center">
              <button onClick={() => setOpen(open === h.id ? null : h.id)} className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-gray-50 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-black flex-1 min-w-[180px]">{h.product_name}</span>
                <span className="text-xs text-gray-500">{d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-sm tabular-nums"><strong>{h.units.toLocaleString('es-ES')}</strong> uds</span>
                <span className="text-sm tabular-nums text-gray-700">Total {fmtDuration(h.elapsed - h.paused)}</span>
                <span className="text-sm tabular-nums text-gray-700">Trabajo {fmtDuration(h.personMinutes)}</span>
              </button>
              <button onClick={() => setConfirm(h.id)} className="p-3 mr-1 text-gray-400 hover:text-red-600 shrink-0" title="Borrar esta tanda" aria-label="Borrar esta tanda"><Trash2 className="w-5 h-5" /></button>
              </div>
              {open === h.id && (
                <div className="px-4 pb-4 pt-1 bg-gray-50/60 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="rounded-lg bg-white border border-gray-100 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Con personal</p><p className="font-bold">{fmtDuration(h.attended)}</p></div>
                    <div className="rounded-lg bg-white border border-gray-100 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Esperas</p><p className="font-bold">{fmtDuration(h.waiting)}</p></div>
                    <div className="rounded-lg bg-white border border-gray-100 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Pausas</p><p className="font-bold">{fmtDuration(h.paused)}</p></div>
                    <div className="rounded-lg bg-white border border-gray-100 p-2.5"><p className="text-[11px] uppercase font-semibold text-gray-500">Tirado</p><p className="font-bold">{h.wasted.toLocaleString('es-ES')} uds</p></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Por etapa</p>
                      {h.stages.map(s => (
                        <div key={s.stage} className="flex justify-between text-sm py-0.5"><span className={cn('text-gray-800', s.kind === 'espera' && 'italic text-amber-800')}>{s.stage}{s.kind === 'espera' ? ' (sin personal)' : s.kind === 'pausa' ? ' (no cuenta)' : ''}</span><span className="tabular-nums font-medium">{fmtDuration(s.minutes)}</span></div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Por persona (tiempo trabajando)</p>
                      {h.people.map(p => (
                        <div key={p.name} className="flex justify-between text-sm py-0.5"><span className="text-gray-800">{p.name}</span><span className="tabular-nums font-medium">{fmtDuration(p.minutes)}</span></div>
                      ))}
                      {h.station && <p className="text-[11px] text-gray-500 mt-1">Estación: {h.station === 'frio' ? 'Frío y envasado' : 'Caliente'}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Pager {...paged} noun="tandas" />
    </div>
  )
}
