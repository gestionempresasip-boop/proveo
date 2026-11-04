'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Minus, Search, Download, Check } from 'lucide-react'
import { markPriceChangesBilled } from '@/app/actions/priceLog'
import { exportReportExcel } from '@/lib/reportExport'
import { unitLabel } from '@/lib/units'

export type PriceLogRow = {
  id: string; product_id: string; product_name: string; unit: string | null
  old_cost: number | null; new_cost: number | null; old_price: number | null; new_price: number | null
  changed_at: string; billed_at: string | null
  changed_by?: string | null; changed_by_name?: string
}

const localDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE') // AAAA-MM-DD en hora local

type Dir = 'sube' | 'baja' | 'igual' | 'nuevo'
type Agg = {
  product_id: string; name: string; unit: string | null
  oldCost: number | null; newCost: number | null; oldPrice: number | null; newPrice: number | null
  last: string; n: number; dir: Dir
}

const r4 = (v: number | null) => Math.round((v ?? 0) * 10000) / 10000
const eur = (v: number | null) => (v == null ? '—' : (v < 1 ? v.toFixed(3) : v.toFixed(2)).replace('.', ',') + ' €')
const pct = (from: number | null, to: number | null) => (from && from > 0 && to != null ? ((to / from) - 1) * 100 : null)
const fmtPct = (p: number | null) => (p == null ? '' : (p > 0 ? '+' : '') + p.toFixed(1).replace('.', ',') + ' %')
const fecha = (iso: string, time = false) => new Date(iso).toLocaleString('es-ES', time
  ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }
  : { day: '2-digit', month: '2-digit', year: '2-digit' })

// Dirección del cambio: manda el coste; si el coste no cambió, el precio.
function directionOf(oldCost: number | null, newCost: number | null, oldPrice: number | null, newPrice: number | null): Dir {
  if (!(r4(oldCost) > 0) && r4(newCost) > 0) return 'nuevo'
  if (r4(newCost) > r4(oldCost)) return 'sube'
  if (r4(newCost) < r4(oldCost)) return 'baja'
  if (!(r4(oldPrice) > 0) && r4(newPrice) > 0) return 'nuevo'
  if (r4(newPrice) > r4(oldPrice)) return 'sube'
  if (r4(newPrice) < r4(oldPrice)) return 'baja'
  return 'igual'
}

const DIR_STYLE: Record<Dir, string> = {
  sube: 'bg-red-50 text-red-700 border-red-200',
  baja: 'bg-green-50 text-green-700 border-green-200',
  igual: 'bg-gray-100 text-gray-600 border-gray-200',
  nuevo: 'bg-blue-50 text-blue-700 border-blue-200',
}
const DIR_LABEL: Record<Dir, string> = { sube: 'Sube', baja: 'Baja', igual: 'Igual que antes', nuevo: 'Nuevo' }

function DirBadge({ dir }: { dir: Dir }) {
  const Icon = dir === 'sube' ? ArrowUp : dir === 'baja' ? ArrowDown : Minus
  return (
    <span className={'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ' + DIR_STYLE[dir]}>
      <Icon className="w-3 h-3" /> {DIR_LABEL[dir]}
    </span>
  )
}

// Varios cambios seguidos del mismo producto se juntan en uno: de lo que valía la primera vez
// (la última vez que se pasó a facturación) a lo que vale ahora.
function aggregate(rows: PriceLogRow[]): Agg[] {
  const by = new Map<string, PriceLogRow[]>()
  for (const r of rows) by.set(r.product_id, [...(by.get(r.product_id) ?? []), r])
  const out: Agg[] = []
  for (const [product_id, list] of by) {
    const asc = [...list].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    const first = asc[0], last = asc[asc.length - 1]
    out.push({
      product_id, name: last.product_name, unit: last.unit,
      oldCost: first.old_cost, newCost: last.new_cost, oldPrice: first.old_price, newPrice: last.new_price,
      last: last.changed_at, n: asc.length,
      dir: directionOf(first.old_cost, last.new_cost, first.old_price, last.new_price),
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function CambiosCosteClient({ pending, history, tableMissing }: { pending: PriceLogRow[]; history: PriceLogRow[]; tableMissing: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')
  const [search, setSearch] = useState('')
  const [dirFilter, setDirFilter] = useState<'todos' | 'sube' | 'baja'>('todos')
  const [off, setOff] = useState<Set<string>>(new Set())   // desmarcados: por defecto van todos
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  const aggs = useMemo(() => aggregate(pending), [pending])
  const q = search.trim().toLowerCase()
  const visible = aggs.filter(a =>
    (!q || a.name.toLowerCase().includes(q)) &&
    (dirFilter === 'todos' || (dirFilter === 'sube' ? a.dir === 'sube' : a.dir === 'baja')))
  const selected = visible.filter(a => !off.has(a.product_id))
  const counts = { sube: aggs.filter(a => a.dir === 'sube').length, baja: aggs.filter(a => a.dir === 'baja').length }

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [who, setWho] = useState('')
  const people = useMemo(() => [...new Set(history.map(r => r.changed_by_name ?? 'Proceso automático'))].sort((a, b) => a.localeCompare(b, 'es')), [history])
  const histVisible = history.filter(r => {
    if (q && !r.product_name.toLowerCase().includes(q)) return false
    const d = localDay(r.changed_at)
    if (from && d < from) return false
    if (to && d > to) return false
    if (who && (r.changed_by_name ?? 'Proceso automático') !== who) return false
    return true
  })

  async function downloadHistory() {
    const rows = histVisible.map(r => {
      const pc = pct(r.old_cost, r.new_cost), pp = pct(r.old_price, r.new_price)
      const d = new Date(r.changed_at)
      return [
        d.toLocaleDateString('es-ES'), d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        r.product_name, r.unit ? unitLabel(r.unit) : '',
        r.old_cost ?? '', r.new_cost ?? '', pc == null ? '' : Math.round(pc * 10) / 10,
        r.old_price ?? '', r.new_price ?? '', pp == null ? '' : Math.round(pp * 10) / 10,
        DIR_LABEL[directionOf(r.old_cost, r.new_cost, r.old_price, r.new_price)],
        r.changed_by_name ?? 'Proceso automático',
        r.billed_at ? 'Pasado el ' + fecha(r.billed_at) : 'Pendiente',
      ]
    })
    await exportReportExcel(
      [{ heading: 'Cambios de coste', headers: ['Fecha', 'Hora', 'Producto', 'Unidad', 'Coste anterior', 'Coste nuevo', 'Var. coste %', 'Precio anterior', 'Precio nuevo', 'Var. precio %', 'Cambio', 'Modificado por', 'Facturación'], rows }],
      'historial_cambios_de_coste_' + new Date().toISOString().slice(0, 10) + '.xlsx',
    )
  }

  function toggle(id: string) {
    setOff(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    const allOn = visible.every(a => !off.has(a.product_id))
    setOff(prev => { const n = new Set(prev); for (const a of visible) { if (allOn) n.add(a.product_id); else n.delete(a.product_id) } return n })
  }

  async function download() {
    const rows = selected.map(a => [
      a.name, a.unit ? unitLabel(a.unit) : '',
      a.oldCost ?? '', a.newCost ?? '', pct(a.oldCost, a.newCost) == null ? '' : Math.round((pct(a.oldCost, a.newCost) as number) * 10) / 10,
      a.oldPrice ?? '', a.newPrice ?? '', pct(a.oldPrice, a.newPrice) == null ? '' : Math.round((pct(a.oldPrice, a.newPrice) as number) * 10) / 10,
      DIR_LABEL[a.dir], fecha(a.last),
    ])
    await exportReportExcel(
      [{ heading: 'Cambios pendientes', headers: ['Producto', 'Unidad', 'Coste anterior', 'Coste nuevo', 'Var. coste %', 'Precio anterior', 'Precio nuevo', 'Var. precio %', 'Cambio', 'Último cambio'], rows }],
      'cambios_de_coste_' + new Date().toISOString().slice(0, 10) + '.xlsx',
    )
  }

  function mark() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await markPriceChangesBilled(selected.map(a => a.product_id))
        setDone(res.marked + ' cambios marcados como pasados a facturación')
        setConfirming(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo marcar')
      }
    })
  }

  if (tableMissing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        Todavía no existe el registro de cambios en Supabase. Hay que ejecutar el SQL de «registro de cambios de coste» y recargar esta página.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-black">Cambios de coste</h1>
        <p className="text-gray-700 mt-0.5 text-sm">Cada vez que cambia el coste o el precio de un producto queda apuntado lo de antes y lo nuevo. Solo lo ve la nave.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['pendientes', 'Pendientes de facturación (' + aggs.length + ')'], ['historial', 'Historial']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={'px-4 py-2 rounded-lg text-sm font-medium ' + (tab === k ? 'bg-white text-black shadow-sm' : 'text-gray-700')}>{l}</button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto…"
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
      </div>

      {tab === 'pendientes' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {([['todos', 'Todos (' + aggs.length + ')'], ['sube', 'Suben (' + counts.sube + ')'], ['baja', 'Bajan (' + counts.baja + ')']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setDirFilter(k)}
                className={'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ' + (dirFilter === k ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#1E2B28]')}>{l}</button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={download} disabled={selected.length === 0}
                className="flex items-center gap-1.5 border border-[#1E2B28] text-[#1E2B28] text-sm font-medium px-3 py-2 rounded-xl hover:bg-green-50 disabled:opacity-50">
                <Download className="w-4 h-4" /> Excel ({selected.length})
              </button>
              {!confirming ? (
                <button onClick={() => setConfirming(true)} disabled={selected.length === 0}
                  className="flex items-center gap-1.5 bg-[#1E2B28] text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-[#141F1C] disabled:opacity-50">
                  <Check className="w-4 h-4" /> Marcar como pasados a facturación
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-amber-900">¿Marcar {selected.length} productos? Saldrán de pendientes (siguen en el historial).</span>
                  <button onClick={mark} disabled={busy} className="text-xs font-semibold bg-[#1E2B28] text-white rounded-lg px-2.5 py-1.5 disabled:opacity-60">{busy ? 'Marcando…' : 'Sí, marcar'}</button>
                  <button onClick={() => setConfirming(false)} disabled={busy} className="text-xs font-medium text-gray-700 px-1.5">No</button>
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {done && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{done}</p>}

          {visible.length === 0 ? (
            <p className="text-sm text-gray-600 py-8 text-center">{aggs.length === 0 ? 'No hay cambios pendientes de pasar a facturación.' : 'Nada con ese filtro.'}</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600">
                <input type="checkbox" checked={visible.every(a => !off.has(a.product_id))} onChange={toggleAll} className="accent-[#1E2B28]" aria-label="Marcar o desmarcar todos" />
                <span>{selected.length} de {visible.length} seleccionados</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {visible.map(a => {
                  const pc = pct(a.oldCost, a.newCost), pp = pct(a.oldPrice, a.newPrice)
                  return (
                    <li key={a.product_id} className="flex items-start gap-3 px-3 py-2.5">
                      <input type="checkbox" checked={!off.has(a.product_id)} onChange={() => toggle(a.product_id)} className="accent-[#1E2B28] mt-1" aria-label={'Incluir ' + a.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-black">{a.name}</span>
                          <DirBadge dir={a.dir} />
                          {a.n > 1 && <span className="text-[11px] text-gray-500">{a.n} cambios juntados</span>}
                        </div>
                        <p className="text-xs text-gray-700 tabular-nums mt-0.5">
                          Coste <b>{eur(a.oldCost)}</b> → <b>{eur(a.newCost)}</b> {pc != null && <span className={pc > 0 ? 'text-red-600' : pc < 0 ? 'text-green-700' : ''}>({fmtPct(pc)})</span>}
                          <span className="mx-2 text-gray-300">|</span>
                          Precio <b>{eur(a.oldPrice)}</b> → <b>{eur(a.newPrice)}</b> {pp != null && <span>({fmtPct(pp)})</span>}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-500 shrink-0">{fecha(a.last)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-gray-700 font-medium">Desde
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-[11px] text-gray-700 font-medium">Hasta
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="block border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-[11px] text-gray-700 font-medium">Modificado por
            <select value={who} onChange={e => setWho(e.target.value)} className="block border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white">
              <option value="">Todos</option>
              {people.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {(from || to || who) && (
            <button onClick={() => { setFrom(''); setTo(''); setWho('') }} className="text-xs font-medium text-gray-700 underline pb-2">Quitar filtros</button>
          )}
          <button onClick={downloadHistory} disabled={histVisible.length === 0}
            className="ml-auto flex items-center gap-1.5 border border-[#1E2B28] text-[#1E2B28] text-sm font-medium px-3 py-2 rounded-xl hover:bg-green-50 disabled:opacity-50">
            <Download className="w-4 h-4" /> Excel ({histVisible.length})
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {histVisible.length === 0 ? (
            <p className="text-sm text-gray-600 py-8 text-center">Todavía no hay cambios registrados.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {histVisible.map(r => {
                const dir = directionOf(r.old_cost, r.new_cost, r.old_price, r.new_price)
                return (
                  <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-black">{r.product_name}</span>
                        <DirBadge dir={dir} />
                        {r.billed_at ? <span className="text-[11px] text-green-700">Pasado a facturación el {fecha(r.billed_at)}</span> : <span className="text-[11px] text-amber-700">Pendiente</span>}
                        <span className="text-[11px] text-gray-600">· {r.changed_by_name ?? 'Proceso automático'}</span>
                      </div>
                      <p className="text-xs text-gray-700 tabular-nums mt-0.5">
                        Coste <b>{eur(r.old_cost)}</b> → <b>{eur(r.new_cost)}</b>
                        <span className="mx-2 text-gray-300">|</span>
                        Precio <b>{eur(r.old_price)}</b> → <b>{eur(r.new_price)}</b>
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-500 shrink-0">{fecha(r.changed_at, true)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        </>
      )}
    </div>
  )
}
