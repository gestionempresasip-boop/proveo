'use client'

import { useMemo, useState } from 'react'
import { Calculator, ChefHat, Download, Plus, Search, Settings2 } from 'lucide-react'
import {
  computeExternal, computeRates, computeSheet, computeUsage, type CostSettings, type CostSheet, type NaveCostItem,
} from '@/lib/realCost'
import type { MeasuredProduct, RunHistoryItem } from '@/app/actions/production'
import { importSheetsFromProducts } from '@/app/actions/realCosts'
import { eur, pct } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { HistorialTandas } from './HistorialTandas'
import { Pager, usePaged } from '@/components/ui/Pager'
import { SettingsPanel } from './SettingsPanel'
import { SheetEditor } from './SheetEditor'
import { TiemposMedidos } from './TiemposMedidos'
import { emptySheet, field, Stat, type Product, type SavedSheet } from './ui'

export function CostesClient({
  items, extraItems, initialSettings, settingsSaved, products, initialSheets, soldPerMonth, measured, history, tableMissing,
}: {
  items: NaveCostItem[]
  extraItems: { name: string; value: number }[]
  initialSettings: CostSettings
  settingsSaved: boolean
  products: Product[]
  initialSheets: SavedSheet[]
  soldPerMonth: Record<string, number>
  measured: MeasuredProduct[]
  history: RunHistoryItem[]
  tableMissing: boolean
}) {
  const [settings, setSettings] = useState<CostSettings>(initialSettings)
  const [showSettings, setShowSettings] = useState(!settingsSaved)
  const [sheets, setSheets] = useState<SavedSheet[]>(initialSheets)
  const [editing, setEditingRaw] = useState<CostSheet | null>(null)
  // La clave solo cambia al abrir otra ficha: al guardar la primera vez no se reinicia el editor.
  const [editorKey, setEditorKey] = useState(0)
  const setEditing = (s: CostSheet | null) => { setEditingRaw(s); setEditorKey(k => k + 1) }

  const [tab, setTab] = useState<'fichas' | 'tiempos' | 'historial'>('fichas')
  const [histFilter, setHistFilter] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'todos' | 'fuera' | 'bajo' | 'sin_tiempo' | 'con_tiempo'>('todos')
  const [sort, setSort] = useState<'nombre' | 'desajuste'>('nombre')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const extraMonthly = extraItems.reduce((a, i) => a + i.value, 0)
  const rates = useMemo(() => computeRates(items, extraMonthly, settings), [items, extraMonthly, settings])
  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

  // Una fila por ficha con el coste real y cómo queda el margen con el precio de hoy.
  const rows = useMemo(() => sheets.map(s => {
    const r = computeSheet(s, rates, settings.indirect_pct)
    const prod = s.product_id ? productById.get(s.product_id) ?? null : null
    const realMargin = prod && r.unitCost > 0 ? ((prod.price - r.unitCost) / r.unitCost) * 100 : null // margen sobre coste con el precio actual
    const gap = realMargin != null ? realMargin - s.markup_pct : null
    // El precio se guarda con 2 decimales: una diferencia de menos de un céntimo es redondeo, no un margen mal puesto.
    const low = gap != null && gap < -0.5 && prod != null && r.suggestedNet - prod.price > 0.006
    return { s, r, prod, realMargin, gap, low, noTime: !(s.minutes > 0), ext: computeExternal(s, r, settings.indirect_pct), isExt: !!s.external }
  }), [sheets, rates, settings.indirect_pct, productById])

  const usage = useMemo(() => computeUsage(sheets, soldPerMonth, rates), [sheets, soldPerMonth, rates])

  const pendingImport = useMemo(() => {
    const taken = new Set(sheets.map(s => s.product_id).filter(Boolean))
    return products.filter(p => p.is_active && p.cost_price > 0 && !taken.has(p.id)).length
  }, [sheets, products])

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(x => {
      if (q && !x.s.name.toLowerCase().includes(q)) return false
      if (filter === 'fuera') return x.isExt
      if (filter === 'bajo') return x.low
      if (filter === 'sin_tiempo') return x.noTime
      if (filter === 'con_tiempo') return !x.noTime
      return true
    })
    return list.sort((a, b) => sort === 'desajuste' ? (a.gap ?? 0) - (b.gap ?? 0) : a.s.name.localeCompare(b.s.name, 'es'))
  }, [rows, query, filter, sort])
  const pagedRows = usePaged(visibleRows, `${query}|${filter}|${sort}`)

  async function runImport() {
    setImporting(true); setImportMsg(null)
    try {
      const res = await importSheetsFromProducts()
      setSheets(prev => [...prev, ...res.sheets].sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setImportMsg(res.created > 0 ? `Se han creado ${res.created} fichas con el coste que ya tenían en Productos.` : 'No había productos nuevos que traer.')
    } catch (e) { setImportMsg(errorMessage(e, 'No se pudo importar')) }
    setImporting(false)
  }

  if (tableMissing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 text-sm">
        <p className="font-semibold">Falta crear las tablas de costes reales en la base de datos.</p>
        <p className="mt-1">Hay que ejecutar la migración <code>20261008b_costes_reales.sql</code> en Supabase. Hasta entonces esta sección no puede guardar nada.</p>
      </div>
    )
  }

  if (editing) {
    return (
      <SheetEditor
        key={editorKey}
        initial={editing}
        rates={rates}
        indirectPct={settings.indirect_pct}
        products={products}
        takenProductIds={new Set(sheets.filter(s => s.id !== editing.id && s.product_id).map(s => s.product_id as string))}
        onClose={() => setEditing(null)}
        onSaved={saved => {
          setSheets(prev => (prev.some(s => s.id === saved.id) ? prev.map(s => (s.id === saved.id ? saved : s)) : [...prev, saved]).sort((a, b) => a.name.localeCompare(b.name, 'es')))
          setEditingRaw(saved)
        }}
        onDeleted={id => { setSheets(prev => prev.filter(s => s.id !== id)); setEditing(null) }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black flex items-center gap-2"><Calculator className="w-6 h-6 text-[#A8793A]" /> Costes reales</h1>
        <p className="text-gray-700 mt-1">Cuánto te cuesta de verdad producir cada cosa —no solo la materia prima— y a qué precio hay que venderla para ganar lo que quieres.</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 max-w-2xl">
        <button onClick={() => setTab('fichas')} className={cn('rounded-lg py-2.5 text-sm font-semibold', tab === 'fichas' ? 'bg-white text-black shadow-sm' : 'text-gray-600')}>Fichas de coste</button>
        <button onClick={() => setTab('tiempos')} className={cn('rounded-lg py-2.5 text-sm font-semibold', tab === 'tiempos' ? 'bg-white text-black shadow-sm' : 'text-gray-600')}>Tiempos medidos ({measured.length})</button>
        <button onClick={() => setTab('historial')} className={cn('rounded-lg py-2.5 text-sm font-semibold', tab === 'historial' ? 'bg-white text-black shadow-sm' : 'text-gray-600')}>Historial de tandas ({history.length})</button>
      </div>

      {tab === 'historial' && <HistorialTandas history={history} filter={histFilter} onFilter={setHistFilter} />}

      {tab === 'tiempos' && <TiemposMedidos measured={measured} onSeeRuns={name => { setHistFilter(name); setTab('historial') }} />}

      <div className={cn('space-y-6', tab === 'tiempos' && 'hidden')}>
      {/* Tarifa de la nave */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-black">Lo que cuesta una hora de trabajo en la nave</h2>
            <p className="text-sm text-gray-600 mt-0.5">Sale de tus costes mensuales (sueldos, luz, hipoteca…) repartidos entre las horas que se produce de verdad.</p>
          </div>
          <button onClick={() => setShowSettings(v => !v)} className="shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg border-2 border-[#1E2B28] text-[#1E2B28] hover:bg-green-50">
            <Settings2 className="w-4 h-4" /> {showSettings ? 'Cerrar' : 'Ajustar'}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat title="Mano de obra" value={`${eur(rates.laborRate, 2)}/h`} hint={`${eur(rates.laborMonthly)} al mes · ${rates.producers} persona${rates.producers !== 1 ? 's' : ''}`} />
          <Stat title="Estructura de la nave" value={`${eur(rates.structureRate, 2)}/h`} hint={`${eur(rates.structureMonthly)} al mes`} />
          <Stat title="Coste total por hora" value={`${eur(rates.laborRate + rates.structureRate, 2)}/h`} hint="por cada persona trabajando" strong />
          <Stat title="Horas productivas" value={`${Math.round(rates.productiveHours).toLocaleString('es-ES')} h/mes`} hint={`${settings.hours_per_person} h × ${settings.efficiency_pct}% rendimiento`} />
        </div>

        <div className="rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="font-semibold text-black text-sm">¿Cuánto de la nave se está usando?</p>
            <p className="text-xs text-gray-500">{usage.withTime} de {usage.soldSheets} productos vendidos tienen tiempo de trabajo</p>
          </div>
          {usage.withTime < 5 ? (
            <p className="text-sm text-gray-700">
              Pon el <strong>tiempo de trabajo</strong> en las fichas de los productos que más se venden y aquí verás cuántas horas de la nave se llevan los restaurantes y cuántas quedan libres. Ese hueco es lo que puedes llenar vendiendo a distribuidores <strong>sin cargar más coste a los restaurantes</strong>.
            </p>
          ) : (
            <>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-[#1E2B28]" style={{ width: `${Math.min(100, usage.util * 100)}%` }} /></div>
              <p className="text-sm text-gray-800">
                Con lo que se vende al mes se usan unas <strong>{Math.round(usage.hours).toLocaleString('es-ES')} h</strong> de las {Math.round(rates.productiveHours).toLocaleString('es-ES')} h productivas (<strong>{pct(Math.min(usage.util, 1) * 100)}</strong>).
                Los clientes cubren <strong>{eur(usage.usedCost)}</strong> del coste de la nave y quedan <strong>{Math.round(usage.idleHours).toLocaleString('es-ES')} h libres</strong> que cuestan <strong>{eur(usage.idleCost)}</strong> al mes.
              </p>
              <p className="text-xs text-gray-600">Las fichas calculan el coste con la tarifa por hora a plena capacidad: los restaurantes pagan solo las horas que usan, no la capacidad vacía. Esa capacidad vacía es lo que puedes llenar vendiendo fuera.</p>
              {usage.withTime < usage.soldSheets && <p className="text-xs text-amber-800">Falta el tiempo de {usage.soldSheets - usage.withTime} productos que se venden: el uso real es mayor.</p>}
            </>
          )}
        </div>

        {rates.producers === 0 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            No hay ninguna persona marcada como personal de producción. Pulsa <strong>Ajustar</strong> y marca quién trabaja en el obrador.
          </p>
        )}

        {showSettings && (
          <SettingsPanel
            items={items}
            settings={settings}
            rates={rates}
            extraItems={extraItems}
            onSaved={s => { setSettings(s); setShowSettings(false) }}
          />
        )}
      </section>

      {/* Fichas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-black text-lg">Fichas de coste de producto <span className="text-sm font-normal text-gray-600">({sheets.length})</span></h2>
          <button onClick={() => setEditing(emptySheet())} className="flex items-center gap-2 rounded-xl bg-[#1E2B28] text-white text-sm font-semibold px-4 py-3 hover:bg-[#141F1C]">
            <Plus className="w-4 h-4" /> Nueva ficha
          </button>
        </div>

        {pendingImport > 0 && (
          <div className="rounded-2xl border-2 border-[#A8793A] bg-amber-50 p-4 flex flex-wrap items-center gap-3">
            <Download className="w-5 h-5 text-[#A8793A] shrink-0" />
            <p className="flex-1 min-w-[220px] text-sm text-amber-950">
              Hay <strong>{pendingImport} productos</strong> con coste en Productos que aún no tienen ficha. Puedo crearlas todas con su coste actual y su margen actual, para que después solo añadas el tiempo de trabajo y veas el coste real.
            </p>
            <button onClick={runImport} disabled={importing} className="rounded-xl bg-[#A8793A] text-white text-sm font-semibold px-4 py-3 hover:bg-[#8F6630] disabled:opacity-50">
              {importing ? 'Creando fichas…' : `Traer los ${pendingImport} costes de Productos`}
            </button>
          </div>
        )}
        {importMsg && <p className="text-sm rounded-xl bg-green-50 border border-green-200 text-green-800 px-3.5 py-3">{importMsg}</p>}

        {sheets.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto…" className={cn(field, 'pl-9')} />
              </div>
              <select value={sort} onChange={e => setSort(e.target.value as 'nombre' | 'desajuste')} className={cn(field, 'w-auto')}>
                <option value="nombre">Ordenar por nombre</option>
                <option value="desajuste">Margen más bajo primero</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([['todos', 'Todos', rows.length], ['fuera', 'Vender a distribuidores', rows.filter(x => x.isExt).length], ['bajo', 'Margen por debajo del objetivo', rows.filter(x => x.low).length], ['con_tiempo', 'Con tiempo de trabajo', rows.filter(x => !x.noTime).length], ['sin_tiempo', 'Sin tiempo de trabajo', rows.filter(x => x.noTime).length]] as const).map(([k, l, n]) => (
                <button key={k} onClick={() => setFilter(k)} className={cn('px-3 py-1.5 rounded-full text-sm font-medium border', filter === k ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300')}>
                  {l} <span className={filter === k ? 'text-white/70' : 'text-gray-500'}>{n}</span>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    {filter === 'fuera' ? (
                      <>
                        <th className="px-3 py-3 font-semibold text-right">Coste real</th>
                        <th className="px-3 py-3 font-semibold text-right">Precio suelo</th>
                        <th className="px-3 py-3 font-semibold text-right">Precio mis restaurantes</th>
                        <th className="px-3 py-3 font-semibold text-right">Precio distribuidor</th>
                        <th className="px-3 py-3 font-semibold text-right">PVP que le deja margen</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-3 font-semibold text-right">Coste en Productos</th>
                        <th className="px-3 py-3 font-semibold text-right">Coste real</th>
                        <th className="px-3 py-3 font-semibold text-right">Precio hoy (sin IVA)</th>
                        <th className="px-3 py-3 font-semibold text-right">Margen hoy</th>
                        <th className="px-3 py-3 font-semibold text-right">Objetivo</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedRows.pageItems.map(({ s, r, prod, realMargin, low, noTime, ext }) => filter === 'fuera' ? (
                    <tr key={s.id} onClick={() => setEditing(s)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-black max-w-[260px] truncate">{s.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{eur(r.unitCost, 3)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{eur(ext.floor, 3)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-800">{eur(r.suggestedNet, 3)} <span className="text-[11px] text-gray-500">(+{pct(s.markup_pct)})</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-sky-900">{eur(ext.price, 3)} <span className="text-[11px] font-normal text-gray-500">(+{pct(s.external?.markup_pct ?? 0)})</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{eur(ext.recommendedPvp, 3)}</td>
                      <td className="px-4 py-2.5">
                        {noTime ? <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Falta tiempo de trabajo</span>
                          : <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Calculado</span>}
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} onClick={() => setEditing(s)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-black max-w-[260px] truncate">{s.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{prod && prod.cost_price > 0 ? eur(prod.cost_price, 3) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{eur(r.unitCost, 3)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{prod ? eur(prod.price, 3) : '—'}</td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold', low ? 'text-red-600' : 'text-green-700')}>{realMargin != null ? pct(realMargin, 1) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{pct(s.markup_pct, 1)}</td>
                      <td className="px-4 py-2.5">
                        {low ? <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Subir precio a {eur(r.suggestedNet, 3)}</span>
                          : noTime ? <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Sin tiempo de trabajo</span>
                          : <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Margen correcto</span>}
                      </td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && <tr><td colSpan={filter === 'fuera' ? 7 : 7} className="px-4 py-10 text-center text-gray-600">No hay fichas que coincidan.</td></tr>}
                </tbody>
              </table>
            </div>
            <Pager {...pagedRows} noun="fichas" />
            <p className="text-[11px] text-gray-500">«Margen hoy» es lo que ganas sobre el coste real con el precio que tiene el producto ahora. «Objetivo» es el margen de la ficha (al traerlas, el que tenía el producto). Pulsa una fila para ver y editar.</p>
          </div>
        )}

        {sheets.length === 0 && pendingImport === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 text-center py-14 px-6 text-gray-600">
            <ChefHat className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-black">Todavía no hay fichas</p>
            <p className="text-sm mt-1">Crea una por cada producto que elaboráis: ingredientes, tiempo de trabajo, bolsa… y te dice el coste real y el precio de venta.</p>
          </div>
        )}
      </section>
      </div>
    </div>
  )
}
