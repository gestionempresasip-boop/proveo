'use client'

import { useState } from 'react'
import { Check, Delete, X } from 'lucide-react'
import { fmtDuration, runMetrics } from '@/lib/productionTime'
import type { RunView } from '@/app/actions/production'
import { cn } from '@/lib/utils'

export function FinishModal({ run, now, onClose, onConfirm }: { run: RunView; now: number; onClose: () => void; onConfirm: (units: number, wasted: number) => void }) {
  const [field, setField] = useState<'units' | 'wasted'>('units')
  const [units, setUnits] = useState('')
  const [wasted, setWasted] = useState('')
  const metrics = runMetrics(run, now)
  const setCur = (f: (s: string) => string) => (field === 'units' ? setUnits(f) : setWasted(f))
  const press = (k: string) => setCur(s => {
    if (k === '⌫') return s.slice(0, -1)
    if (k === ',') return s.includes('.') || s === '' ? s : s + '.'
    return s.length >= 8 ? s : s + k
  })
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']
  const valid = Number(units) > 0
  const box = (f: 'units' | 'wasted', label: string, value: string) => (
    <button onClick={() => setField(f)} className={cn('flex-1 rounded-xl border-2 px-4 py-3 text-left', field === f ? 'border-[#1E2B28] bg-green-50' : 'border-gray-200')}>
      <span className="block text-xs font-semibold text-gray-600 uppercase">{label}</span>
      <span className="block text-3xl font-bold tabular-nums text-black h-10">{value || '0'}</span>
    </button>
  )
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-black leading-tight">Terminar: {run.product_name}</h2>
            <p className="text-sm text-gray-600 mt-1">Total {fmtDuration(metrics.elapsed - metrics.paused)} · con personal {fmtDuration(metrics.attended)} · esperas {fmtDuration(metrics.waiting)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex gap-3">{box('units', `Han salido (${run.unit})`, units)}{box('wasted', 'Tirado (opcional)', wasted)}</div>
        <div className="grid grid-cols-3 gap-2">
          {keys.map(k => (
            <button key={k} onClick={() => press(k)} className="rounded-xl bg-gray-100 active:bg-gray-200 text-2xl font-bold text-black py-4 flex items-center justify-center">{k === '⌫' ? <Delete className="w-6 h-6" /> : k}</button>
          ))}
        </div>
        <button disabled={!valid} onClick={() => onConfirm(Number(units), Number(wasted) || 0)} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1E2B28] text-white text-xl font-bold py-5 disabled:opacity-40"><Check className="w-6 h-6" /> Guardar y terminar</button>
      </div>
    </div>
  )
}
