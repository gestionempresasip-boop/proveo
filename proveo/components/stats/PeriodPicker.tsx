'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { monthLabel, monthRange, type Range } from '@/lib/finance'

export type FinPeriod = {
  mode: 'mes' | 'custom'
  year: number
  month: number // 0-11
  from: string  // YYYY-MM-DD (modo custom)
  to: string
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export function currentPeriod(): FinPeriod {
  const now = new Date()
  return { mode: 'mes', year: now.getFullYear(), month: now.getMonth(), from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
}

export function periodRange(p: FinPeriod): Range {
  if (p.mode === 'mes') return monthRange(p.year, p.month)
  const from = parseLocal(p.from) ?? new Date()
  const toIncl = parseLocal(p.to) ?? from
  const to = new Date(toIncl.getFullYear(), toIncl.getMonth(), toIncl.getDate() + 1)
  return to > from ? { from, to } : { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) }
}

export function periodLabel(p: FinPeriod): string {
  if (p.mode === 'mes') return monthLabel(p.year, p.month)
  const f = parseLocal(p.from), t = parseLocal(p.to)
  const fmt = (d: Date | null) => d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '?'
  return `${fmt(f)} – ${fmt(t)}`
}

export function isCurrentMonth(p: FinPeriod): boolean {
  const now = new Date()
  return p.mode === 'mes' && p.year === now.getFullYear() && p.month === now.getMonth()
}

export function PeriodPicker({ value, onChange }: { value: FinPeriod; onChange: (p: FinPeriod) => void }) {
  const now = new Date()
  const isFuture = value.mode === 'mes' && (value.year > now.getFullYear() || (value.year === now.getFullYear() && value.month >= now.getMonth()))

  function shift(delta: number) {
    const d = new Date(value.year, value.month + delta, 1)
    onChange({ ...value, mode: 'mes', year: d.getFullYear(), month: d.getMonth() })
  }

  function setMonthFromInput(v: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(v)
    if (m) onChange({ ...value, mode: 'mes', year: Number(m[1]), month: Number(m[2]) - 1 })
  }

  function quickCustom(from: Date, to: Date) {
    onChange({ ...value, mode: 'custom', from: iso(from), to: iso(to) })
  }

  const seg = (active: boolean) => cn(
    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
    active ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-black'
  )
  const chip = 'px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-700 hover:border-gray-300'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => onChange({ ...value, mode: 'mes' })} className={seg(value.mode === 'mes')}>Mes a mes</button>
          <button onClick={() => onChange({ ...value, mode: 'custom' })} className={seg(value.mode === 'custom')}>Personalizado</button>
        </div>

        {value.mode === 'mes' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center" aria-label="Mes anterior">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <label className="relative">
              <span className="block min-w-[170px] text-center font-bold text-black text-base px-3 py-2 rounded-xl border border-gray-200 cursor-pointer">
                {monthLabel(value.year, value.month)}
              </span>
              <input
                type="month"
                value={`${value.year}-${String(value.month + 1).padStart(2, '0')}`}
                onChange={e => setMonthFromInput(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Elegir mes"
              />
            </label>
            <button onClick={() => shift(1)} disabled={isFuture} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-30" aria-label="Mes siguiente">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Desde</label>
              <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Hasta</label>
              <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={chip} onClick={() => onChange({ ...currentPeriod() })}>Este mes</button>
        <button className={chip} onClick={() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); onChange({ ...value, mode: 'mes', year: d.getFullYear(), month: d.getMonth() }) }}>Mes pasado</button>
        <button className={chip} onClick={() => quickCustom(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), now)}>Últimos 30 días</button>
        <button className={chip} onClick={() => { const q = Math.floor(now.getMonth() / 3) * 3; quickCustom(new Date(now.getFullYear(), q, 1), now) }}>Este trimestre</button>
        <button className={chip} onClick={() => quickCustom(new Date(now.getFullYear(), 0, 1), now)}>Este año</button>
      </div>
    </div>
  )
}
