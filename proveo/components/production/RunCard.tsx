'use client'

import { useMemo, useState } from 'react'
import { Hourglass, LogOut, Pause, Play, Square, UserPlus, Users } from 'lucide-react'
import { fmtClock, fmtDuration, PAUSE_STAGE, runMetrics, STAGE_PRESETS } from '@/lib/productionTime'
import type { RunView } from '@/app/actions/production'
import { cn } from '@/lib/utils'
import { KIND_LABEL, KIND_STYLE, type Station } from './shared'

export function RunCard({ run, now, worker, station, busy, onStage, onJoin, onLeave, onFinish, onCancel }: {
  run: RunView; now: number; worker: { id: string; name: string }; station: Station; busy: boolean
  onStage: (stage: string) => void; onJoin: () => void; onLeave: () => void; onFinish: () => void; onCancel: () => void
}) {
  const [confirmCancel, setConfirmCancel] = useState(false)
  const current = run.stages.find(s => !s.ended_at) ?? run.stages[run.stages.length - 1]
  const metrics = runMetrics(run, now)
  const inRun = run.participants.some(p => p.worker_id === worker.id && !p.left_at)
  const present = run.participants.filter(p => !p.left_at)
  const lastWork = [...run.stages].reverse().find(s => s.kind !== 'pausa')?.stage
  const paused = current?.kind === 'pausa'
  const presets = useMemo(() => {
    const st = station === 'todas' ? null : station
    return [...STAGE_PRESETS].sort((a, b) => Number(!!st && b.stations.includes(st)) - Number(!!st && a.stations.includes(st)))
      .map(p => ({ ...p, dim: !!st && !p.stations.includes(st) }))
  }, [station])
  const stageMs = current ? now - new Date(current.started_at).getTime() : 0

  return (
    <div className="rounded-2xl bg-white border-2 border-gray-200 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold text-black leading-tight">{run.product_name}</p>
          <p className="text-sm text-gray-500">Empezó a las {new Date(run.started_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums text-black">{fmtClock(now - new Date(run.started_at).getTime())}</p>
          <p className="text-xs text-gray-500">en total</p>
        </div>
      </div>

      {current && (
        <div className={cn('rounded-xl border-2 px-4 py-3 flex items-center justify-between gap-3', KIND_STYLE[current.kind])}>
          <div>
            <p className="font-bold text-lg leading-tight">{current.stage}</p>
            <p className="text-xs font-medium">{KIND_LABEL[current.kind]}</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">{fmtClock(stageMs)}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Users className="w-4 h-4 text-gray-500" />
        {present.length === 0 ? <span className="text-sm text-gray-500">Nadie en la tanda</span> : present.map(p => (
          <span key={p.worker_id} className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900">{p.name}</span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {presets.map(p => {
          const active = current?.stage === p.stage
          return (
            <button key={p.stage} onClick={() => onStage(p.stage)} disabled={busy}
              className={cn('rounded-xl border-2 px-3 py-4 text-left transition-all active:scale-[0.98]', active ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white border-gray-200 hover:border-[#1E2B28] text-black', p.dim && !active && 'opacity-50')}>
              <span className="flex items-center gap-1.5 font-bold text-base leading-tight">{p.kind === 'espera' && <Hourglass className="w-4 h-4 shrink-0" />}{p.stage}</span>
              <span className={cn('block text-[11px] mt-0.5 leading-tight', active ? 'text-white/70' : 'text-gray-500')}>{p.hint}</span>
            </button>
          )
        })}
        <button onClick={() => (paused ? onStage(lastWork ?? 'Preparación') : onStage(PAUSE_STAGE))} disabled={busy}
          className={cn('rounded-xl border-2 px-3 py-4 flex items-center justify-center gap-2 font-bold text-base active:scale-[0.98]', paused ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-300 text-gray-800')}>
          {paused ? <><Play className="w-5 h-5" /> Seguir</> : <><Pause className="w-5 h-5" /> Pausa</>}
        </button>
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
        <span>Con personal: <strong>{fmtDuration(metrics.attended)}</strong></span>
        <span>Esperas: <strong>{fmtDuration(metrics.waiting)}</strong></span>
        <span>Pausas: <strong>{fmtDuration(metrics.paused)}</strong></span>
      </div>

      <div className="flex flex-wrap gap-2">
        {inRun ? (
          <button onClick={onLeave} disabled={busy} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 text-gray-800 font-semibold py-4 text-base"><LogOut className="w-5 h-5" /> Salgo de la tanda</button>
        ) : (
          <button onClick={onJoin} disabled={busy} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl border-2 border-[#1E2B28] text-[#1E2B28] font-semibold py-4 text-base"><UserPlus className="w-5 h-5" /> Me uno</button>
        )}
        <button onClick={onFinish} disabled={busy} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl bg-[#A8793A] text-white font-bold py-4 text-base hover:bg-[#8F6630]"><Square className="w-5 h-5" /> Terminar</button>
      </div>

      {confirmCancel ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700 flex-1">¿Cancelar esta tanda? No se guardan sus tiempos.</span>
          <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-red-600 text-white font-semibold">Sí, cancelar</button>
          <button onClick={() => setConfirmCancel(false)} className="px-3 py-2 rounded-lg border border-gray-300">No</button>
        </div>
      ) : (
        <button onClick={() => setConfirmCancel(true)} className="text-xs text-gray-500 underline">Me he equivocado: cancelar tanda</button>
      )}
    </div>
  )
}
