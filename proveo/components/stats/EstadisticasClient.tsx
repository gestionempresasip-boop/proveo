'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, Download, Minus } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type OrderLine = {
  order_id: string; order_number: number; created_at: string
  restaurant_id: string; restaurant_name: string
  product_id: string; product_name: string
  quantity: number; unit: string; unit_price: number
  item_total: number; order_total: number
}
type Restaurant = { id: string; name: string }
type DateFilter = 'mes' | 'trimestre' | 'año' | 'custom'
type GroupBy = 'semana' | 'mes'

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOf(unit: 'month' | 'quarter' | 'year') {
  const d = new Date()
  if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0) }
  if (unit === 'quarter') { const m = Math.floor(d.getMonth()/3)*3; d.setMonth(m,1); d.setHours(0,0,0,0) }
  if (unit === 'year') { d.setMonth(0,1); d.setHours(0,0,0,0) }
  return d
}

function periodKey(dateStr: string, groupBy: GroupBy) {
  const d = new Date(dateStr)
  if (groupBy === 'semana') {
    const week = Math.ceil(d.getDate() / 7)
    return `S${week} ${d.toLocaleDateString('es-ES', { month: 'short' })} ${d.getFullYear()}`
  }
  return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

// Sort period keys chronologically
function sortPeriods(periods: string[], groupBy: GroupBy) {
  if (groupBy === 'mes') {
    const MONTHS: Record<string,number> = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 }
    return [...periods].sort((a, b) => {
      const [ma, ya] = a.split(' '); const [mb, yb] = b.split(' ')
      return (Number(ya) - Number(yb)) || ((MONTHS[ma] ?? 0) - (MONTHS[mb] ?? 0))
    })
  }
  return periods // weeks stay in insertion order
}

// Heatmap cell background
function cellBg(value: number, max: number): string {
  if (!max || !value) return ''
  const t = value / max
  const alpha = 0.07 + t * 0.38
  return `rgba(27,67,50,${alpha.toFixed(2)})`
}

function cellText(value: number, max: number): string {
  if (!max || !value) return 'text-gray-400'
  return value / max > 0.6 ? 'text-[#1B4332] font-semibold' : 'text-gray-700'
}

// Trend vs previous period
function Trend({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 5) return <Minus className="w-3 h-3 text-gray-400 inline" />
  return pct > 0
    ? <span className="text-red-500 text-xs font-medium">▲{pct.toFixed(0)}%</span>
    : <span className="text-green-600 text-xs font-medium">▼{Math.abs(pct).toFixed(0)}%</span>
}

// Export CSV
function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => typeof c === 'string' && c.includes(',') ? `"${c}"` : c).join(','))].join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = filename; a.click()
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function EstadisticasClient({ lines, restaurants }: { lines: OrderLine[]; restaurants: Restaurant[] }) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('año')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('mes')
  const [restFilter, setRestFilter] = useState('todos')
  const [tab, setTab] = useState<'periodo' | 'productos' | 'ranking'>('periodo')
  const [prodSearch, setProdSearch] = useState('')

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const since: Record<DateFilter, Date | null> = {
      mes: startOf('month'), trimestre: startOf('quarter'), año: startOf('year'), custom: null
    }
    return lines.filter(l => {
      const d = new Date(l.created_at)
      let passDate = true
      if (dateFilter === 'custom') {
        const from = dateFrom ? new Date(dateFrom) : null
        const to = dateTo ? new Date(new Date(dateTo).getTime() + 86399999) : null
        passDate = (!from || d >= from) && (!to || d <= to)
      } else {
        const s = since[dateFilter]; passDate = s ? d >= s : true
      }
      return passDate && (restFilter === 'todos' || l.restaurant_id === restFilter)
    })
  }, [lines, dateFilter, dateFrom, dateTo, restFilter])

  // ── Período × Restaurante ────────────────────────────────────────────────

  const periodoTable = useMemo(() => {
    // periods (columns) and restaurants (rows)
    const periodSet = new Set<string>()
    const restSet = new Set<string>()
    const cell: Record<string, Record<string, { euros: number; pedidos: Set<string> }>> = {}

    filtered.forEach(l => {
      const p = periodKey(l.created_at, groupBy)
      periodSet.add(p)
      restSet.add(l.restaurant_name)
      if (!cell[l.restaurant_name]) cell[l.restaurant_name] = {}
      if (!cell[l.restaurant_name][p]) cell[l.restaurant_name][p] = { euros: 0, pedidos: new Set() }
      if (!cell[l.restaurant_name][p].pedidos.has(l.order_id)) {
        cell[l.restaurant_name][p].pedidos.add(l.order_id)
        cell[l.restaurant_name][p].euros += l.order_total
      }
    })

    const periods = sortPeriods([...periodSet], groupBy)
    const restNames = [...restSet].sort()

    // column maxes for heatmap
    const colMax: Record<string, number> = {}
    periods.forEach(p => {
      colMax[p] = Math.max(...restNames.map(r => cell[r]?.[p]?.euros ?? 0))
    })

    // row totals
    const rowTotal: Record<string, number> = {}
    restNames.forEach(r => {
      rowTotal[r] = periods.reduce((s, p) => s + (cell[r]?.[p]?.euros ?? 0), 0)
    })

    // column totals
    const colTotal: Record<string, number> = {}
    periods.forEach(p => {
      colTotal[p] = restNames.reduce((s, r) => s + (cell[r]?.[p]?.euros ?? 0), 0)
    })

    const grandTotal = restNames.reduce((s, r) => s + rowTotal[r], 0)
    const maxTotal = Math.max(...Object.values(rowTotal))

    return { periods, restNames, cell, colMax, rowTotal, colTotal, grandTotal, maxTotal }
  }, [filtered, groupBy])

  // ── Producto × Restaurante ───────────────────────────────────────────────

  const productoTable = useMemo(() => {
    const restNames = [...new Set(filtered.map(l => l.restaurant_name))].sort()
    const prodMap: Record<string, { name: string; unit: string; byRest: Record<string, { qty: number; euros: number; veces: number }> }> = {}

    filtered.forEach(l => {
      if (!prodMap[l.product_id]) prodMap[l.product_id] = { name: l.product_name, unit: l.unit, byRest: {} }
      if (!prodMap[l.product_id].byRest[l.restaurant_name])
        prodMap[l.product_id].byRest[l.restaurant_name] = { qty: 0, euros: 0, veces: 0 }
      prodMap[l.product_id].byRest[l.restaurant_name].qty += l.quantity
      prodMap[l.product_id].byRest[l.restaurant_name].euros += l.item_total
      prodMap[l.product_id].byRest[l.restaurant_name].veces++
    })

    const products = Object.values(prodMap)
      .filter(p => !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()))
      .sort((a, b) => {
        const ta = Object.values(a.byRest).reduce((s, v) => s + v.euros, 0)
        const tb = Object.values(b.byRest).reduce((s, v) => s + v.euros, 0)
        return tb - ta
      })

    // Column max per restaurant for heatmap (by euros)
    const restMax: Record<string, number> = {}
    restNames.forEach(r => {
      restMax[r] = Math.max(...products.map(p => p.byRest[r]?.euros ?? 0))
    })

    return { products, restNames, restMax }
  }, [filtered, prodSearch])

  // ── Ranking ──────────────────────────────────────────────────────────────

  const ranking = useMemo(() => {
    // Top restaurantes por gasto total
    const restTotals: Record<string, { name: string; euros: number; pedidos: Set<string> }> = {}
    const prodTotals: Record<string, { name: string; unit: string; qty: number; euros: number; veces: number }> = {}

    filtered.forEach(l => {
      if (!restTotals[l.restaurant_id]) restTotals[l.restaurant_id] = { name: l.restaurant_name, euros: 0, pedidos: new Set() }
      if (!restTotals[l.restaurant_id].pedidos.has(l.order_id)) {
        restTotals[l.restaurant_id].pedidos.add(l.order_id)
        restTotals[l.restaurant_id].euros += l.order_total
      }
      if (!prodTotals[l.product_id]) prodTotals[l.product_id] = { name: l.product_name, unit: l.unit, qty: 0, euros: 0, veces: 0 }
      prodTotals[l.product_id].qty += l.quantity
      prodTotals[l.product_id].euros += l.item_total
      prodTotals[l.product_id].veces++
    })

    const rests = Object.values(restTotals).sort((a, b) => b.euros - a.euros)
    const prods = Object.values(prodTotals).sort((a, b) => b.euros - a.euros)
    const maxRest = rests[0]?.euros ?? 1
    const maxProd = prods[0]?.euros ?? 1

    // Biggest orderer per product
    const prodLeader: Record<string, string> = {}
    const prodByRest: Record<string, Record<string, number>> = {}
    filtered.forEach(l => {
      if (!prodByRest[l.product_name]) prodByRest[l.product_name] = {}
      prodByRest[l.product_name][l.restaurant_name] = (prodByRest[l.product_name][l.restaurant_name] ?? 0) + l.item_total
    })
    Object.entries(prodByRest).forEach(([prod, rests]) => {
      prodLeader[prod] = Object.entries(rests).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    })

    return { rests, prods, maxRest, maxProd, prodLeader }
  }, [filtered])

  // ── Export handlers ──────────────────────────────────────────────────────

  function exportPeriodo() {
    const { periods, restNames, cell, rowTotal } = periodoTable
    const headers = ['Restaurante', ...periods, 'TOTAL']
    const rows = restNames.map(r => [
      r,
      ...periods.map(p => cell[r]?.[p]?.euros.toFixed(2) ?? '0.00'),
      rowTotal[r].toFixed(2),
    ])
    exportCSV(headers, rows, 'estadisticas-periodo.csv')
  }

  function exportProductos() {
    const { products, restNames } = productoTable
    const headers = ['Producto', 'Unidad', ...restNames, 'Total €']
    const rows = products.map(p => [
      p.name, p.unit,
      ...restNames.map(r => p.byRest[r]?.qty.toFixed(2) ?? '0'),
      restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0).toFixed(2),
    ])
    exportCSV(headers, rows, 'estadisticas-productos.csv')
  }

  const totalGasto = useMemo(() => {
    const seen = new Set<string>()
    return filtered.reduce((s, l) => { if (!seen.has(l.order_id)) { seen.add(l.order_id); return s + l.order_total } return s }, 0)
  }, [filtered])

  const totalPedidos = useMemo(() => new Set(filtered.map(l => l.order_id)).size, [filtered])

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Estadísticas</h1>
        <p className="text-gray-500 text-sm mt-1">Consumo comparativo por restaurante y producto</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([['mes','Este mes'],['trimestre','Trimestre'],['año','Este año'],['custom','Personalizado']] as [DateFilter,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setDateFilter(k)}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                dateFilter === k ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 p-3">
          {dateFilter === 'custom' && (
            <>
              <div className="flex-1 min-w-[130px]">
                <label className="text-xs text-gray-400 block mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="text-xs text-gray-400 block mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
            </>
          )}
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-400 block mb-1">Agrupar por</label>
            <div className="relative">
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] appearance-none pr-8">
                <option value="mes">Mes</option>
                <option value="semana">Semana</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-400 block mb-1">Restaurante</label>
            <div className="relative">
              <select value={restFilter} onChange={e => setRestFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] appearance-none pr-8">
                <option value="todos">Todos</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pedidos', value: totalPedidos, suffix: '' },
          { label: 'Gasto total', value: totalGasto.toFixed(2), suffix: '€' },
          { label: 'Restaurantes', value: new Set(filtered.map(l => l.restaurant_id)).size, suffix: '' },
          { label: 'Productos distintos', value: new Set(filtered.map(l => l.product_id)).size, suffix: '' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">{k.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-[#1C1C1E] mt-0.5">{k.value}{k.suffix}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['periodo','Por período'],['productos','Por producto'],['ranking','Ranking']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              tab === k ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {/* ── TAB: PERÍODO ─────────────────────────────────────────────────── */}
      {tab === 'periodo' && (() => {
        const { periods, restNames, cell, colMax, rowTotal, colTotal, grandTotal, maxTotal } = periodoTable
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Las celdas más oscuras = mayor gasto. Mueve la tabla horizontalmente si no caben todas las columnas.</p>
              <button onClick={exportPeriodo} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: Math.max(600, periods.length * 120 + 180) }}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium sticky left-0 bg-gray-50 z-10 min-w-[140px]">Restaurante</th>
                      {periods.map(p => (
                        <th key={p} className="text-center px-3 py-3 text-xs text-gray-400 font-medium whitespace-nowrap min-w-[100px]">{p}</th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs text-gray-500 font-semibold min-w-[100px]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restNames.map(r => (
                      <tr key={r} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-[#1C1C1E] sticky left-0 bg-white z-10 border-r border-gray-50">{r}</td>
                        {periods.map((p, pi) => {
                          const v = cell[r]?.[p]
                          const euros = v?.euros ?? 0
                          const prevPeriod = pi > 0 ? cell[r]?.[periods[pi-1]]?.euros : undefined
                          return (
                            <td key={p} className="px-3 py-2 text-center"
                              style={{ background: cellBg(euros, colMax[p]) }}>
                              {euros > 0 ? (
                                <>
                                  <p className={`text-sm ${cellText(euros, colMax[p])}`}>{euros.toFixed(0)}€</p>
                                  <p className="text-xs text-gray-400">{v!.pedidos.size} ped.</p>
                                  <Trend current={euros} prev={prevPeriod} />
                                </>
                              ) : <span className="text-gray-200 text-xs">—</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right" style={{ background: cellBg(rowTotal[r], maxTotal) }}>
                          <p className={`text-sm font-bold ${cellText(rowTotal[r], maxTotal)}`}>{rowTotal[r].toFixed(0)}€</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-4 py-3 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">TOTAL</td>
                      {periods.map(p => (
                        <td key={p} className="px-3 py-3 text-center">
                          <p className="text-sm font-bold text-[#1C1C1E]">{colTotal[p].toFixed(0)}€</p>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-bold text-[#1B4332]">{grandTotal.toFixed(0)}€</p>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {restNames.length === 0 && <p className="text-center py-12 text-gray-400">Sin datos para este período</p>}
            </div>
            {/* Leyenda */}
            <div className="flex items-center gap-3 text-xs text-gray-400 px-1">
              <span>Intensidad:</span>
              {[0.1, 0.25, 0.5, 0.75, 1].map(t => (
                <span key={t} className="w-6 h-4 rounded inline-block" style={{ background: `rgba(27,67,50,${0.07 + t * 0.38})` }} />
              ))}
              <span>mayor gasto →</span>
            </div>
          </div>
        )
      })()}

      {/* ── TAB: PRODUCTOS ───────────────────────────────────────────────── */}
      {tab === 'productos' && (() => {
        const { products, restNames, restMax } = productoTable
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <input type="text" placeholder="Buscar producto..." value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] w-52" />
              <p className="text-xs text-gray-400 flex-1">Cantidades pedidas por restaurante. Celdas oscuras = mayor consumo.</p>
              <button onClick={exportProductos} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: Math.max(600, restNames.length * 140 + 200) }}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium sticky left-0 bg-gray-50 z-10 min-w-[180px]">Producto</th>
                      {restNames.map(r => (
                        <th key={r} className="text-center px-3 py-3 text-xs text-gray-400 font-medium min-w-[110px]">{r}</th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs text-gray-500 font-semibold min-w-[90px]">Total €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const totalEuros = restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0)
                      return (
                        <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-50">
                            <p className="font-medium text-[#1C1C1E] text-sm leading-tight">{p.name}</p>
                          </td>
                          {restNames.map(r => {
                            const v = p.byRest[r]
                            return (
                              <td key={r} className="px-3 py-2 text-center"
                                style={{ background: cellBg(v?.euros ?? 0, restMax[r]) }}>
                                {v ? (
                                  <>
                                    <p className={`text-sm ${cellText(v.euros, restMax[r])}`}>
                                      {v.qty % 1 === 0 ? v.qty : v.qty.toFixed(1)} {p.unit}
                                    </p>
                                    <p className="text-xs text-gray-400">{v.euros.toFixed(0)}€</p>
                                  </>
                                ) : <span className="text-gray-200 text-xs">—</span>}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-[#1B4332] text-sm">{totalEuros.toFixed(0)}€</p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {products.length === 0 && <p className="text-center py-12 text-gray-400">Sin datos para este período</p>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 px-1">
              <span>Intensidad por columna:</span>
              {[0.1, 0.25, 0.5, 0.75, 1].map(t => (
                <span key={t} className="w-6 h-4 rounded inline-block" style={{ background: `rgba(27,67,50,${0.07 + t * 0.38})` }} />
              ))}
              <span>mayor consumo en ese restaurante →</span>
            </div>
          </div>
        )
      })()}

      {/* ── TAB: RANKING ─────────────────────────────────────────────────── */}
      {tab === 'ranking' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ranking restaurantes */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#1C1C1E]">Restaurantes por gasto</h2>
              <span className="text-xs text-gray-400">{ranking.rests.length} restaurantes</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ranking.rests.map((r, i) => (
                <div key={r.name} className="px-5 py-3 flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1C1C1E] text-sm">{r.name}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-[#1B4332] rounded-full transition-all" style={{ width: `${(r.euros / ranking.maxRest) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1B4332] text-sm">{r.euros.toFixed(0)}€</p>
                    <p className="text-xs text-gray-400">{r.pedidos.size} ped.</p>
                  </div>
                </div>
              ))}
              {ranking.rests.length === 0 && <p className="text-center py-10 text-gray-400">Sin datos</p>}
            </div>
          </div>

          {/* Ranking productos */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#1C1C1E]">Productos más consumidos</h2>
              <span className="text-xs text-gray-400">{ranking.prods.length} productos</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ranking.prods.slice(0, 20).map((p, i) => (
                <div key={p.name} className="px-5 py-3 flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1C1C1E] text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${(p.euros / ranking.maxProd) * 100}%` }} />
                      </div>
                      {ranking.prodLeader[p.name] && (
                        <span className="text-xs text-gray-400 shrink-0 truncate max-w-[80px]">↑ {ranking.prodLeader[p.name]}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1B4332] text-sm">{p.euros.toFixed(0)}€</p>
                    <p className="text-xs text-gray-400">{p.qty % 1 === 0 ? p.qty : p.qty.toFixed(1)} {p.unit}</p>
                  </div>
                </div>
              ))}
              {ranking.prods.length === 0 && <p className="text-center py-10 text-gray-400">Sin datos</p>}
            </div>
          </div>

          {/* Media por pedido × restaurante */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-[#1C1C1E]">Media por pedido y gasto acumulado</h2>
              <p className="text-xs text-gray-400 mt-0.5">Cuánto gasta de media cada restaurante en cada pedido</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Restaurante</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Pedidos</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Total acumulado</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Media / pedido</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">% del total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ranking.rests.map(r => (
                    <tr key={r.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-[#1C1C1E]">{r.name}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{r.pedidos.size}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#1B4332]">{r.euros.toFixed(2)}€</td>
                      <td className="px-5 py-3 text-right text-gray-600">{(r.euros / r.pedidos.size).toFixed(2)}€</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#1B4332] rounded-full" style={{ width: `${(r.euros / ranking.maxRest) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">
                            {((r.euros / (ranking.rests.reduce((s,x) => s + x.euros, 0) || 1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ranking.rests.length === 0 && <p className="text-center py-10 text-gray-400">Sin datos</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
