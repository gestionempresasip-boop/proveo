'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Flame, Play, Snowflake, Timer, Users } from 'lucide-react'
import {
  getProductionState, startRun, switchStage, joinRun, leaveRun, finishRun, cancelRun,
  addProductionWorker, removeProductionWorker,
  type ProductionState, type RunView,
} from '@/app/actions/production'
import { fmtDuration } from '@/lib/productionTime'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { FinishModal } from './FinishModal'
import { ProductPicker } from './ProductPicker'
import { RunCard } from './RunCard'
import { readLS, STATION_KEY, WORKER_KEY, writeLS, type Station } from './shared'
import { WorkerPicker } from './WorkerPicker'
import { WorkersModal } from './WorkersModal'

export function ProduccionClient({ initial }: { initial: ProductionState | { error: string } }) {
  const initialNow = 'error' in initial ? null : initial.serverNow
  const [data, setData] = useState<ProductionState | null>('error' in initial ? null : initial)
  const [error, setError] = useState<string | null>('error' in initial ? initial.error : null)
  const [workerId, setWorkerId] = useState<string | null>(null)
  const [station, setStation] = useState<Station>('todas')
  // Reloj de la pantalla: hora del servidor (las tablets pueden llevar la hora mal) que avanza cada segundo.
  const offsetRef = useRef(0)
  const [now, setNow] = useState('error' in initial ? 0 : initial.serverNow)
  const [picker, setPicker] = useState(false)
  const [finishing, setFinishing] = useState<RunView | null>(null)
  const [managing, setManaging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (initialNow !== null) offsetRef.current = initialNow - Date.now()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee la tablet/trabajador guardados en este dispositivo
    setWorkerId(readLS(WORKER_KEY))
    const st = readLS(STATION_KEY)
    if (st === 'caliente' || st === 'frio' || st === 'todas') setStation(st)
  }, [initialNow])

  const refresh = useCallback(async () => {
    const res = await getProductionState()
    if ('error' in res) { setError(res.error); return }
    setError(null)
    setData(res)
    offsetRef.current = res.serverNow - Date.now()
    setNow(res.serverNow)
  }, [])

  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 10000)
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offsetRef.current), 1000)
    return () => clearInterval(id)
  }, [])

  const worker = data?.workers.find(w => w.id === workerId) ?? null

  function pickWorker(id: string | null) { setWorkerId(id); writeLS(WORKER_KEY, id) }
  function pickStation(s: Station) { setStation(s); writeLS(STATION_KEY, s) }

  async function act(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true)
    try { await fn(); await refresh(); if (okMsg) { setToast(okMsg); setTimeout(() => setToast(null), 2500) } }
    catch (e) { setToast(errorMessage(e, 'No se pudo hacer')); setTimeout(() => setToast(null), 3500) }
    setBusy(false)
  }

  if (error && !data) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 text-sm"><p className="font-semibold">{error}</p><p className="mt-1">Hay que ejecutar la migración <code>20261009_produccion_cronometro.sql</code> en Supabase.</p></div>
  }
  if (!data) return null

  const stationBtn = (s: Station, label: string, Icon: React.ElementType) => (
    <button onClick={() => pickStation(s)} className={cn('flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold border-2 transition-colors', station === s ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-gray-700 border-gray-200')}>
      <Icon className="w-5 h-5" /> {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-black flex items-center gap-2"><Timer className="w-7 h-7 text-[#A8793A]" /> Producción</h1>
        <div className="flex flex-wrap gap-2">
          {stationBtn('caliente', 'Caliente', Flame)}
          {stationBtn('frio', 'Frío y envasado', Snowflake)}
          {stationBtn('todas', 'Todo', Users)}
        </div>
      </div>

      {toast && <p className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] rounded-xl bg-black text-white text-base px-5 py-3 shadow-xl">{toast}</p>}

      {!worker ? (
        <WorkerPicker workers={data.workers} onPick={pickWorker} onManage={() => setManaging(true)} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white border border-gray-100 px-4 py-3">
            <p className="text-lg"><span className="text-gray-500">Hola,</span> <strong className="text-black">{worker.name}</strong></p>
            <div className="flex gap-2">
              <button onClick={() => setManaging(true)} className="text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700">Trabajadores</button>
              <button onClick={() => pickWorker(null)} className="text-sm font-semibold px-3.5 py-2 rounded-lg border-2 border-[#1E2B28] text-[#1E2B28]">No soy {worker.name.split(' ')[0]}</button>
            </div>
          </div>

          <button onClick={() => setPicker(true)} disabled={busy} className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#1E2B28] text-white text-xl font-bold py-6 hover:bg-[#141F1C] active:scale-[0.99] disabled:opacity-60">
            <Play className="w-7 h-7" /> Empezar una producción
          </button>

          {data.runs.length === 0 ? (
            <p className="text-center text-gray-600 py-10">No hay ninguna producción en marcha.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {data.runs.map(run => (
                <RunCard key={run.id} run={run} now={now} worker={worker} station={station} busy={busy}
                  onStage={stage => act(() => switchStage(run.id, stage))}
                  onJoin={() => act(() => joinRun(run.id, worker.id), 'Te has unido')}
                  onLeave={() => act(() => leaveRun(run.id, worker.id), 'Has salido de la tanda')}
                  onFinish={() => setFinishing(run)}
                  onCancel={() => act(() => cancelRun(run.id), 'Tanda cancelada')}
                />
              ))}
            </div>
          )}
        </>
      )}

      {data.today.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4">
          <p className="font-bold text-black mb-2">Terminadas hoy</p>
          <div className="divide-y divide-gray-100">
            {data.today.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 font-medium text-black">{r.product_name}</span>
                <span className="text-gray-600 tabular-nums">{r.units.toLocaleString('es-ES')} uds</span>
                <span className="text-gray-600 tabular-nums w-24 text-right">{fmtDuration(r.minutes)}</span>
                <span className="text-gray-400 tabular-nums w-12 text-right">{new Date(r.ended_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Los tiempos quedan guardados y los revisa el encargado.</p>
        </div>
      )}

      {picker && worker && (
        <ProductPicker products={data.products} onClose={() => setPicker(false)}
          onPick={async p => { setPicker(false); await act(() => startRun(p.id, worker.id, station === 'todas' ? null : station), `Empezada: ${p.name}`) }} />
      )}
      {finishing && (
        <FinishModal run={finishing} now={now} onClose={() => setFinishing(null)}
          onConfirm={async (units, wasted) => { const id = finishing.id; setFinishing(null); await act(() => finishRun(id, units, wasted), 'Producción terminada') }} />
      )}
      {managing && (
        <WorkersModal workers={data.workers} onClose={() => setManaging(false)}
          onAdd={n => act(() => addProductionWorker(n))} onRemove={id => act(() => removeProductionWorker(id))} />
      )}
    </div>
  )
}
