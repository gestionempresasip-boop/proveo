'use client'

import { useState, useMemo, useRef, Fragment } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, Minus, Calculator } from 'lucide-react'
import { unitLabel, realQuantityLabel, CONVERTIBLE_UNITS, toKg, toLitros } from '@/lib/units'

// ── Types ────────────────────────────────────────────────────────────────────

type OrderLine = {
  order_id: string; order_number: number; created_at: string
  restaurant_id: string; restaurant_name: string
  product_id: string; product_name: string
  quantity: number; unit: string; unit_price: number
  item_total: number; order_total: number
}
type Restaurant = { id: string; name: string }
type DateFilter = 'dia' | 'semana' | 'mes' | 'año' | 'custom'
type GroupBy = 'semana' | 'mes'

// ── Helpers ──────────────────────────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month' | 'year') {
  const d = new Date()
  if (unit === 'day') { d.setHours(0,0,0,0) }
  if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0) }
  if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0) }
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
  if (!max || !value) return 'text-gray-600'
  return value / max > 0.6 ? 'text-[#1E2B28] font-semibold' : 'text-gray-700'
}

// Trend vs previous period
function Trend({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 5) return <Minus className="w-3 h-3 text-gray-600 inline" />
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

// Wrapper para tablas anchas: scroll horizontal con la rueda del ratón (sin Shift)
// y flechas de navegación visibles en escritorio.
function HScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
  }

  function scrollBy(amount: number) {
    ref.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <div className="relative group">
      <div
        ref={ref}
        onWheel={onWheel}
        className="overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100"
      >
        {children}
      </div>
      <button
        onClick={() => scrollBy(-280)}
        className="hidden lg:flex absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-[#1E2B28] opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Desplazar a la izquierda"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => scrollBy(280)}
        className="hidden lg:flex absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:text-[#1E2B28] opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Desplazar a la derecha"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// Conversor sencillo: cantidad pedida (bolsas, barquetas...) → kg o litros reales.
function UnitConverter() {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState<string>(CONVERTIBLE_UNITS[0]?.value ?? 'kg')
  const [qty, setQty] = useState('1')

  const num = parseFloat(qty.replace(',', '.')) || 0
  const kg = toKg(unit, num)
  const lt = toLitros(unit, num)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <span className="flex items-center gap-2 text-sm font-medium text-black">
          <Calculator className="w-4 h-4 text-[#1E2B28]" /> Conversor de unidades
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Cantidad</label>
            <input
              type="number" step="0.01" value={qty} onChange={e => setQty(e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Unidad</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="border border-[#1E2B28]/25 bg-[#1E2B28]/10 text-black rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]">
              {CONVERTIBLE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
            <span className="text-gray-600 mr-1">Equivale a</span>
            <span className="font-bold text-[#1E2B28]">
              {kg != null && `${kg % 1 === 0 ? kg : kg.toFixed(2)} kg`}
              {lt != null && `${lt % 1 === 0 ? lt : lt.toFixed(2)} lt`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function EstadisticasClient({ lines, restaurants }: { lines: OrderLine[]; restaurants: Restaurant[] }) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('mes')
  const [restFilter, setRestFilter] = useState('todos')
  const [tab, setTab] = useState<'periodo' | 'productos' | 'ranking'>('periodo')
  const [prodSearch, setProdSearch] = useState('')
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const since: Record<DateFilter, Date | null> = {
      dia: startOf('day'), semana: startOf('week'), mes: startOf('month'), año: startOf('year'), custom: null
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
    const prodMap: Record<string, { id: string; name: string; unit: string; byRest: Record<string, { qty: number; euros: number; veces: number }> }> = {}

    filtered.forEach(l => {
      if (!prodMap[l.product_id]) prodMap[l.product_id] = { id: l.product_id, name: l.product_name, unit: l.unit, byRest: {} }
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
        <h1 className="text-xl sm:text-2xl font-bold text-black">Estadísticas</h1>
        <p className="text-gray-700 text-sm mt-1">Consumo comparativo por restaurante y producto</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([['dia','Hoy'],['semana','Esta semana'],['mes','Este mes'],['año','Este año'],['custom','Personalizado']] as [DateFilter,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setDateFilter(k)}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                dateFilter === k ? 'bg-[#1E2B28] text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 p-3">
          {dateFilter === 'custom' && (
            <>
              <div className="flex-1 min-w-[130px]">
                <label className="text-xs text-gray-600 block mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="text-xs text-gray-600 block mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28]" />
              </div>
            </>
          )}
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-600 block mb-1">Agrupar por</label>
            <div className="relative">
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
                className="w-full border border-[#1E2B28]/25 bg-[#1E2B28]/10 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] appearance-none pr-8">
                <option value="mes">Mes</option>
                <option value="semana">Semana</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-600 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-600 block mb-1">Restaurante</label>
            <div className="relative">
              <select value={restFilter} onChange={e => setRestFilter(e.target.value)}
                className="w-full border border-[#1E2B28]/25 bg-[#1E2B28]/10 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] appearance-none pr-8">
                <option value="todos">Todos</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-600 absolute right-2.5 top-2.5 pointer-events-none" />
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
            <p className="text-xs text-gray-600">{k.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-black mt-0.5">{k.value}{k.suffix}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['periodo','Por período'],['productos','Por producto'],['ranking','Ranking']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              tab === k ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {/* ── TAB: PERÍODO ─────────────────────────────────────────────────── */}
      {tab === 'periodo' && (() => {
        const { periods, restNames, cell, colMax, rowTotal, colTotal, grandTotal, maxTotal } = periodoTable
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">Las celdas más oscuras = mayor gasto. Mueve la tabla horizontalmente si no caben todas las columnas.</p>
              <button onClick={exportPeriodo} className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <HScroll>
                <table className="w-full text-sm" style={{ minWidth: Math.max(600, periods.length * 120 + 180) }}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium sticky left-0 bg-gray-50 z-10 min-w-[140px]">Restaurante</th>
                      {periods.map(p => (
                        <th key={p} className="text-center px-3 py-3 text-xs text-gray-600 font-medium whitespace-nowrap min-w-[100px]">{p}</th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs text-gray-700 font-semibold min-w-[100px]">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restNames.map(r => (
                      <tr key={r} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-black sticky left-0 bg-white z-10 border-r border-gray-50">{r}</td>
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
                                  <p className="text-xs text-gray-600">{v!.pedidos.size} ped.</p>
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
                      <td className="px-4 py-3 text-xs font-semibold text-gray-700 sticky left-0 bg-gray-50">TOTAL</td>
                      {periods.map(p => (
                        <td key={p} className="px-3 py-3 text-center">
                          <p className="text-sm font-bold text-black">{colTotal[p].toFixed(0)}€</p>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-bold text-[#1E2B28]">{grandTotal.toFixed(0)}€</p>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </HScroll>
              {restNames.length === 0 && <p className="text-center py-12 text-gray-600">Sin datos para este período</p>}
            </div>
            {/* Leyenda */}
            <div className="flex items-center gap-3 text-xs text-gray-600 px-1">
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
            <UnitConverter />
            <div className="flex flex-wrap items-center gap-3">
              <input type="text" placeholder="Buscar producto..." value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] w-52" />
              <p className="text-xs text-gray-600 flex-1">Cantidades pedidas por restaurante. Celdas oscuras = mayor consumo. Pulsa un producto para ver el ranking.</p>
              <button onClick={exportProductos} className="flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <HScroll>
                <table className="w-full text-sm" style={{ minWidth: Math.max(600, restNames.length * 140 + 200) }}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs text-gray-600 font-medium sticky left-0 bg-gray-50 z-10 min-w-[180px]">Producto</th>
                      {restNames.map(r => (
                        <th key={r} className="text-center px-3 py-3 text-xs text-gray-600 font-medium min-w-[110px]">{r}</th>
                      ))}
                      <th className="text-right px-4 py-3 text-xs text-gray-700 font-semibold min-w-[90px]">Total €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const totalEuros = restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0)
                      const isExpanded = expandedProduct === p.id
                      return (
                        <Fragment key={p.id}>
                          <tr
                            className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                            onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
                          >
                            <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-50">
                              <p className={`font-medium text-sm leading-tight ${isExpanded ? 'text-[#1E2B28]' : 'text-black'}`}>{p.name}</p>
                            </td>
                            {restNames.map(r => {
                              const v = p.byRest[r]
                              return (
                                <td key={r} className="px-3 py-2 text-center"
                                  style={{ background: cellBg(v?.euros ?? 0, restMax[r]) }}>
                                  {v ? (
                                    <>
                                      <p className={`text-sm ${cellText(v.euros, restMax[r])}`}>
                                        {v.qty % 1 === 0 ? v.qty : v.qty.toFixed(1)} {unitLabel(p.unit)}
                                      </p>
                                      {realQuantityLabel(p.unit, v.qty) && (
                                        <p className="text-[10px] text-gray-600">{realQuantityLabel(p.unit, v.qty)}</p>
                                      )}
                                      <p className="text-xs text-gray-600">{v.euros.toFixed(0)}€</p>
                                    </>
                                  ) : <span className="text-gray-200 text-xs">—</span>}
                                </td>
                              )
                            })}
                            <td className="px-4 py-3 text-right">
                              <p className="font-semibold text-[#1E2B28] text-sm">{totalEuros.toFixed(0)}€</p>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-[#1E2B28]/[0.03] border-b border-gray-100">
                              <td colSpan={restNames.length + 2} className="px-4 py-4">
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                                  Ranking de "{p.name}" por restaurante
                                </p>
                                <div className="space-y-1.5 max-w-xl">
                                  {restNames
                                    .filter(r => p.byRest[r])
                                    .sort((a, b) => (p.byRest[b]?.qty ?? 0) - (p.byRest[a]?.qty ?? 0))
                                    .map((r, i) => {
                                      const v = p.byRest[r]!
                                      const maxQty = Math.max(...restNames.map(x => p.byRest[x]?.qty ?? 0))
                                      return (
                                        <div key={r} className="flex items-center gap-3">
                                          <span className="w-5 h-5 rounded-full bg-white text-[10px] font-bold text-gray-700 flex items-center justify-center shrink-0 border border-gray-200">{i + 1}</span>
                                          <span className="text-sm text-black w-32 shrink-0 truncate">{r}</span>
                                          <div className="flex-1 h-2 bg-white rounded-full overflow-hidden border border-gray-100">
                                            <div className="h-full bg-[#A8793A] rounded-full" style={{ width: `${(v.qty / maxQty) * 100}%` }} />
                                          </div>
                                          <span className="text-sm font-semibold text-[#1E2B28] w-20 text-right shrink-0">
                                            {v.qty % 1 === 0 ? v.qty : v.qty.toFixed(1)} {unitLabel(p.unit)}
                                            {realQuantityLabel(p.unit, v.qty) && (
                                              <span className="block text-[10px] text-gray-600 font-normal">{realQuantityLabel(p.unit, v.qty)}</span>
                                            )}
                                          </span>
                                        </div>
                                      )
                                    })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </HScroll>
              {products.length === 0 && <p className="text-center py-12 text-gray-600">Sin datos para este período</p>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600 px-1">
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
              <h2 className="font-semibold text-black">Restaurantes por gasto</h2>
              <span className="text-xs text-gray-600">{ranking.rests.length} restaurantes</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ranking.rests.map((r, i) => (
                <div key={r.name} className="px-5 py-3 flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-700 flex items-center justify-center shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black text-sm">{r.name}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-[#1E2B28] rounded-full transition-all" style={{ width: `${(r.euros / ranking.maxRest) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1E2B28] text-sm">{r.euros.toFixed(0)}€</p>
                    <p className="text-xs text-gray-600">{r.pedidos.size} ped.</p>
                  </div>
                </div>
              ))}
              {ranking.rests.length === 0 && <p className="text-center py-10 text-gray-600">Sin datos</p>}
            </div>
          </div>

          {/* Ranking productos */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-black">Productos más consumidos</h2>
              <span className="text-xs text-gray-600">{ranking.prods.length} productos</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ranking.prods.slice(0, 20).map((p, i) => (
                <div key={p.name} className="px-5 py-3 flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-700 flex items-center justify-center shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#A8793A] rounded-full" style={{ width: `${(p.euros / ranking.maxProd) * 100}%` }} />
                      </div>
                      {ranking.prodLeader[p.name] && (
                        <span className="text-xs text-gray-600 shrink-0 truncate max-w-[80px]">↑ {ranking.prodLeader[p.name]}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1E2B28] text-sm">{p.euros.toFixed(0)}€</p>
                    <p className="text-xs text-gray-600">{p.qty % 1 === 0 ? p.qty : p.qty.toFixed(1)} {unitLabel(p.unit)}</p>
                    {realQuantityLabel(p.unit, p.qty) && (
                      <p className="text-[10px] text-gray-700">{realQuantityLabel(p.unit, p.qty)}</p>
                    )}
                  </div>
                </div>
              ))}
              {ranking.prods.length === 0 && <p className="text-center py-10 text-gray-600">Sin datos</p>}
            </div>
          </div>

          {/* Media por pedido × restaurante */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-black">Media por pedido y gasto acumulado</h2>
              <p className="text-xs text-gray-600 mt-0.5">Cuánto gasta de media cada restaurante en cada pedido</p>
            </div>
            <HScroll>
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-gray-600 font-medium">Restaurante</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-600 font-medium">Pedidos</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-600 font-medium">Total acumulado</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-600 font-medium">Media / pedido</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-600 font-medium">% del total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ranking.rests.map(r => (
                    <tr key={r.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-black">{r.name}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{r.pedidos.size}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#1E2B28]">{r.euros.toFixed(2)}€</td>
                      <td className="px-5 py-3 text-right text-gray-600">{(r.euros / r.pedidos.size).toFixed(2)}€</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#1E2B28] rounded-full" style={{ width: `${(r.euros / ranking.maxRest) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-700 w-10 text-right">
                            {((r.euros / (ranking.rests.reduce((s,x) => s + x.euros, 0) || 1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ranking.rests.length === 0 && <p className="text-center py-10 text-gray-600">Sin datos</p>}
            </HScroll>
          </div>
        </div>
      )}
    </div>
  )
}
