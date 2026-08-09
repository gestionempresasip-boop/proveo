'use client'

import { useState, useMemo, useRef, Fragment } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Calculator, AlertTriangle, Info, TrendingUp, TrendingDown, FileDown, PackageX } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { unitLabel, realQuantityLabel, CONVERTIBLE_UNITS, toKg, toLitros } from '@/lib/units'
import { exportReportExcel, exportReportPDF, exportExecutiveSummaryPDF, type ReportSection } from '@/lib/reportExport'
import { ExportMenu } from '@/components/stats/ExportMenu'

// ── Types ────────────────────────────────────────────────────────────────────

type OrderLine = {
  order_id: string; order_number: number; created_at: string
  restaurant_id: string; restaurant_name: string
  product_id: string; product_name: string
  quantity: number; unit: string; unit_price: number
  item_total: number; order_total: number
  cost_price: number; iva_rate: number
}

// El margen compara ingreso vs. coste, y solo tiene sentido si las dos
// cifras están en la misma base fiscal: item_total lleva el IVA con el que
// se factura al restaurante, cost_price no lleva ningún IVA aplicado. Se
// resta aquí antes de comparar, en un único sitio para no desincronizar
// las tres fórmulas que usan margen (tabla, resumen y exportación).
function netOfIva(line: OrderLine): number {
  return line.item_total / (1 + (line.iva_rate || 0))
}

// Mismos umbrales que los colores de la tabla: ≥40% verde, ≥20% naranja,
// por debajo (o negativo) rojo. null = sin coste registrado, no entra en
// ningún bracket de color.
type MarginBracket = 'verde' | 'naranja' | 'rojo'
function marginBracket(pct: number | null): MarginBracket | null {
  if (pct == null) return null
  if (pct >= 40) return 'verde'
  if (pct >= 20) return 'naranja'
  return 'rojo'
}
type StockRow = { product_id: string; current_stock: number; min_stock: number }
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

export function EstadisticasClient({ lines, restaurants, stockRows }: { lines: OrderLine[]; restaurants: Restaurant[]; stockRows: StockRow[] }) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('mes')
  const [restFilter, setRestFilter] = useState('todos')
  const [tab, setTab] = useState<'resumen' | 'periodo' | 'productos' | 'ranking'>('resumen')
  const [prodSearch, setProdSearch] = useState('')
  const [showMargin, setShowMargin] = useState(false)
  const [marginFilter, setMarginFilter] = useState<'todos' | MarginBracket>('todos')
  const [showAllProducts, setShowAllProducts] = useState(false)
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
    const prodMap: Record<string, {
      id: string; name: string; unit: string
      byRest: Record<string, { qty: number; euros: number; veces: number }>
      costTotal: number; eurosWithCost: number; netRevenueWithCost: number; qtyWithCost: number
    }> = {}

    filtered.forEach(l => {
      if (!prodMap[l.product_id]) prodMap[l.product_id] = { id: l.product_id, name: l.product_name, unit: l.unit, byRest: {}, costTotal: 0, eurosWithCost: 0, netRevenueWithCost: 0, qtyWithCost: 0 }
      if (!prodMap[l.product_id].byRest[l.restaurant_name])
        prodMap[l.product_id].byRest[l.restaurant_name] = { qty: 0, euros: 0, veces: 0 }
      prodMap[l.product_id].byRest[l.restaurant_name].qty += l.quantity
      prodMap[l.product_id].byRest[l.restaurant_name].euros += l.item_total
      prodMap[l.product_id].byRest[l.restaurant_name].veces++
      if (l.cost_price > 0) {
        prodMap[l.product_id].costTotal += l.cost_price * l.quantity
        prodMap[l.product_id].eurosWithCost += l.item_total
        prodMap[l.product_id].netRevenueWithCost += netOfIva(l)
        prodMap[l.product_id].qtyWithCost += l.quantity
      }
    })

    const withMargin = Object.values(prodMap).map(p => {
      const marginPct = p.netRevenueWithCost > 0 ? ((p.netRevenueWithCost - p.costTotal) / p.netRevenueWithCost) * 100 : null
      const unitMargin = p.qtyWithCost > 0 ? (p.netRevenueWithCost - p.costTotal) / p.qtyWithCost : null
      return { ...p, marginPct, unitMargin, marginBracket: marginBracket(marginPct) }
    })

    const products = withMargin
      .filter(p => !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()))
      .filter(p => marginFilter === 'todos' || !showMargin || p.marginBracket === marginFilter)
      .sort((a, b) => {
        const ta = Object.values(a.byRest).reduce((s, v) => s + v.euros, 0)
        const tb = Object.values(b.byRest).reduce((s, v) => s + v.euros, 0)
        return tb - ta
      })

    const marginCounts = { verde: 0, naranja: 0, rojo: 0, sinCoste: 0 }
    withMargin.forEach(p => {
      if (p.marginBracket === 'verde') marginCounts.verde++
      else if (p.marginBracket === 'naranja') marginCounts.naranja++
      else if (p.marginBracket === 'rojo') marginCounts.rojo++
      else marginCounts.sinCoste++
    })

    // Column max per restaurant for heatmap (by euros)
    const restMax: Record<string, number> = {}
    restNames.forEach(r => {
      restMax[r] = Math.max(...products.map(p => p.byRest[r]?.euros ?? 0))
    })

    return { products, restNames, restMax, marginCounts }
  }, [filtered, prodSearch, showMargin, marginFilter])

  // ── Ranking ──────────────────────────────────────────────────────────────

  const ranking = useMemo(() => {
    // Top restaurantes por gasto total
    const restTotals: Record<string, { name: string; euros: number; pedidos: Set<string> }> = {}
    const prodTotals: Record<string, { id: string; name: string; unit: string; qty: number; euros: number; veces: number }> = {}

    filtered.forEach(l => {
      if (!restTotals[l.restaurant_id]) restTotals[l.restaurant_id] = { name: l.restaurant_name, euros: 0, pedidos: new Set() }
      if (!restTotals[l.restaurant_id].pedidos.has(l.order_id)) {
        restTotals[l.restaurant_id].pedidos.add(l.order_id)
        restTotals[l.restaurant_id].euros += l.order_total
      }
      if (!prodTotals[l.product_id]) prodTotals[l.product_id] = { id: l.product_id, name: l.product_name, unit: l.unit, qty: 0, euros: 0, veces: 0 }
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

  // ── Resumen ejecutivo ─────────────────────────────────────────────────────
  // Todo lo de aquí es de solo lectura sobre "lines"/"filtered" — no toca ni
  // reutiliza el estado de las otras pestañas, así que no puede romperlas.

  function previousPeriodRange(filter: DateFilter, from: string, to: string): { start: Date; end: Date } | null {
    if (filter === 'dia') {
      const end = startOf('day')
      const start = new Date(end); start.setDate(start.getDate() - 1)
      return { start, end }
    }
    if (filter === 'semana') {
      const end = startOf('week')
      const start = new Date(end); start.setDate(start.getDate() - 7)
      return { start, end }
    }
    if (filter === 'mes') {
      const end = startOf('month')
      const start = new Date(end); start.setMonth(start.getMonth() - 1)
      return { start, end }
    }
    if (filter === 'año') {
      const end = startOf('year')
      const start = new Date(end); start.setFullYear(start.getFullYear() - 1)
      return { start, end }
    }
    if (filter === 'custom' && from && to) {
      const start = new Date(from)
      const end = new Date(new Date(to).getTime() + 86399999)
      const lengthMs = end.getTime() - start.getTime()
      return { start: new Date(start.getTime() - lengthMs), end: new Date(start.getTime()) }
    }
    return null
  }

  const previousLines = useMemo(() => {
    const range = previousPeriodRange(dateFilter, dateFrom, dateTo)
    if (!range) return []
    return lines.filter(l => {
      const d = new Date(l.created_at)
      return d >= range.start && d < range.end && (restFilter === 'todos' || l.restaurant_id === restFilter)
    })
  }, [lines, dateFilter, dateFrom, dateTo, restFilter])

  function summarizeLines(ls: OrderLine[]) {
    const orderIds = new Set<string>()
    let euros = 0
    ls.forEach(l => { if (!orderIds.has(l.order_id)) { orderIds.add(l.order_id); euros += l.order_total } })
    return {
      euros, pedidos: orderIds.size,
      ticketMedio: orderIds.size > 0 ? euros / orderIds.size : 0,
      restaurantes: new Set(ls.map(l => l.restaurant_id)).size,
    }
  }

  const currentSummary = useMemo(() => summarizeLines(filtered), [filtered])
  const previousSummary = useMemo(() => summarizeLines(previousLines), [previousLines])
  const hasPreviousPeriod = previousLines.length > 0

  function pctChange(current: number, prev: number): number | null {
    if (!hasPreviousPeriod || prev === 0) return null
    return ((current - prev) / prev) * 100
  }

  // Margen: solo sobre productos con cost_price registrado — "coverage" dice
  // qué % de la facturación queda cubierto por esa muestra, para no mostrar
  // un margen "medio" engañoso si la mayoría de productos no tienen coste.
  const marginSummary = useMemo(() => {
    let revenueWithCost = 0, netRevenueWithCost = 0, cost = 0
    filtered.forEach(l => {
      if (l.cost_price > 0) {
        revenueWithCost += l.item_total
        netRevenueWithCost += netOfIva(l)
        cost += l.cost_price * l.quantity
      }
    })
    const totalRevenue = filtered.reduce((s, l) => s + l.item_total, 0)
    return {
      marginPct: netRevenueWithCost > 0 ? ((netRevenueWithCost - cost) / netRevenueWithCost) * 100 : null,
      coverage: totalRevenue > 0 ? (revenueWithCost / totalRevenue) * 100 : 0,
    }
  }, [filtered])

  // Evolución para el gráfico: ventana fija de períodos recientes,
  // independiente del filtro de fecha activo (para tener siempre contexto),
  // respetando solo el filtro de restaurante.
  const evolutionData = useMemo(() => {
    const base = restFilter === 'todos' ? lines : lines.filter(l => l.restaurant_id === restFilter)
    const byPeriod: Record<string, { euros: number; pedidos: Set<string> }> = {}
    base.forEach(l => {
      const p = periodKey(l.created_at, groupBy)
      if (!byPeriod[p]) byPeriod[p] = { euros: 0, pedidos: new Set() }
      if (!byPeriod[p].pedidos.has(l.order_id)) { byPeriod[p].pedidos.add(l.order_id); byPeriod[p].euros += l.order_total }
    })
    const periods = sortPeriods(Object.keys(byPeriod), groupBy).slice(-10)
    return periods.map(p => ({ periodo: p, euros: Math.round(byPeriod[p].euros), pedidos: byPeriod[p].pedidos.size }))
  }, [lines, restFilter, groupBy])

  // Alertas: frases generadas solas a partir de los datos, para no tener que
  // interpretar tablas para saber qué es importante.
  const alerts = useMemo(() => {
    type AlertItem = { level: 'warn' | 'info'; text: string }
    const list: AlertItem[] = []

    // Caídas de restaurante > 20% vs período anterior (solo si el anterior
    // ya tenía un mínimo de actividad, para no alertar por ruido)
    const perRestCurrent: Record<string, { name: string; euros: number; orders: Set<string> }> = {}
    filtered.forEach(l => {
      if (!perRestCurrent[l.restaurant_id]) perRestCurrent[l.restaurant_id] = { name: l.restaurant_name, euros: 0, orders: new Set() }
      if (!perRestCurrent[l.restaurant_id].orders.has(l.order_id)) {
        perRestCurrent[l.restaurant_id].orders.add(l.order_id)
        perRestCurrent[l.restaurant_id].euros += l.order_total
      }
    })
    const perRestPrevious: Record<string, number> = {}
    const seenPrevOrders: Record<string, Set<string>> = {}
    previousLines.forEach(l => {
      if (!seenPrevOrders[l.restaurant_id]) seenPrevOrders[l.restaurant_id] = new Set()
      if (!seenPrevOrders[l.restaurant_id].has(l.order_id)) {
        seenPrevOrders[l.restaurant_id].add(l.order_id)
        perRestPrevious[l.restaurant_id] = (perRestPrevious[l.restaurant_id] ?? 0) + l.order_total
      }
    })
    if (hasPreviousPeriod) {
      Object.entries(perRestCurrent).forEach(([id, cur]) => {
        const prevEuros = perRestPrevious[id] ?? 0
        if (prevEuros >= 50 && cur.euros < prevEuros * 0.8) {
          const pct = Math.round(((prevEuros - cur.euros) / prevEuros) * 100)
          list.push({ level: 'warn', text: `${cur.name} ha bajado un ${pct}% respecto al período anterior` })
        }
      })
    }

    // Productos "dormidos": no se piden desde hace entre 14 y 60 días (más
    // de 60 se asume descatalogado a propósito, no hace falta avisar)
    const lastOrderByProduct: Record<string, { name: string; date: number }> = {}
    lines.forEach(l => {
      const t = new Date(l.created_at).getTime()
      if (!lastOrderByProduct[l.product_id] || t > lastOrderByProduct[l.product_id].date) {
        lastOrderByProduct[l.product_id] = { name: l.product_name, date: t }
      }
    })
    const now = Date.now()
    const dormant = Object.values(lastOrderByProduct)
      .filter(p => (now - p.date) > 14 * 86400000 && (now - p.date) < 60 * 86400000)
      .sort((a, b) => a.date - b.date)
    if (dormant.length > 0 && dormant.length <= 4) {
      dormant.forEach(p => {
        const days = Math.floor((now - p.date) / 86400000)
        list.push({ level: 'info', text: `${p.name} no se pide desde hace ${days} días` })
      })
    } else if (dormant.length > 4) {
      list.push({ level: 'info', text: `${dormant.length} productos no se piden desde hace más de 2 semanas` })
    }

    // Concentración de riesgo: 1-2 restaurantes acaparando la mayoría del gasto
    const sorted = Object.values(perRestCurrent).sort((a, b) => b.euros - a.euros)
    const totalEuros = sorted.reduce((s, r) => s + r.euros, 0)
    if (sorted.length >= 3 && totalEuros > 0) {
      const top2 = sorted.slice(0, 2).reduce((s, r) => s + r.euros, 0)
      const pct = Math.round((top2 / totalEuros) * 100)
      if (pct >= 60) {
        list.push({ level: 'warn', text: `${sorted[0].name} y ${sorted[1].name} concentran el ${pct}% de las ventas de este período` })
      }
    }

    return list
  }, [filtered, previousLines, lines, hasPreviousPeriod])

  // Cruce ventas × stock: productos que se están vendiendo bien en este
  // período y ahora mismo tienen poco stock en la nave — el puente directo
  // entre "informe de ventas" y "qué comprar".
  const stockCrossRef = useMemo(() => {
    const stockByProduct = new Map(stockRows.map(s => [s.product_id, s]))
    const sold: Record<string, { name: string; unit: string; qty: number; euros: number }> = {}
    filtered.forEach(l => {
      if (!sold[l.product_id]) sold[l.product_id] = { name: l.product_name, unit: l.unit, qty: 0, euros: 0 }
      sold[l.product_id].qty += l.quantity
      sold[l.product_id].euros += l.item_total
    })
    return Object.entries(sold)
      .map(([productId, v]) => {
        const s = stockByProduct.get(productId)
        if (!s) return null
        const threshold = s.min_stock > 0 ? s.min_stock : 1
        if (s.current_stock > threshold) return null
        return { productId, ...v, stock: s.current_stock, minStock: s.min_stock }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.euros - a.euros)
      .slice(0, 8)
  }, [filtered, stockRows])

  // Margen "atrapado" en stock: cuánto beneficio potencial tienes parado en
  // el almacén ahora mismo, si vendieras todo lo que tienes al margen
  // habitual de cada producto. Usa TODO el histórico (no el filtro de
  // fecha activo) para el margen unitario — el stock es una foto de ahora
  // mismo, no de un período concreto, así que el margen de referencia debe
  // ser el más estable posible.
  const stockMarginValue = useMemo(() => {
    const byProduct: Record<string, { name: string; unit: string; netRevenue: number; cost: number; qty: number }> = {}
    lines.forEach(l => {
      if (l.cost_price <= 0) return
      if (!byProduct[l.product_id]) byProduct[l.product_id] = { name: l.product_name, unit: l.unit, netRevenue: 0, cost: 0, qty: 0 }
      byProduct[l.product_id].netRevenue += netOfIva(l)
      byProduct[l.product_id].cost += l.cost_price * l.quantity
      byProduct[l.product_id].qty += l.quantity
    })
    const stockByProduct = new Map(stockRows.map(s => [s.product_id, s.current_stock]))
    const rows = Object.entries(byProduct)
      .map(([productId, v]) => {
        const stock = stockByProduct.get(productId) ?? 0
        if (stock <= 0 || v.qty <= 0) return null
        const unitCost = v.cost / v.qty
        const unitNetPrice = v.netRevenue / v.qty
        const unitMargin = unitNetPrice - unitCost
        const marginPct = unitNetPrice > 0 ? (unitMargin / unitNetPrice) * 100 : null
        return {
          productId, name: v.name, unit: v.unit, stock, unitMargin, marginPct,
          stockValue: unitMargin * stock, stockCost: unitCost * stock,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    const totalProfit = rows.reduce((s, r) => s + r.stockValue, 0)
    const totalCost = rows.reduce((s, r) => s + r.stockCost, 0)
    const topPositive = [...rows].sort((a, b) => b.stockValue - a.stockValue).slice(0, 6)
    const negative = rows.filter(r => r.stockValue < 0).sort((a, b) => a.stockValue - b.stockValue).slice(0, 4)
    return { total: totalProfit, totalCost, topPositive, negative }
  }, [lines, stockRows])

  // ── Export handlers ──────────────────────────────────────────────────────
  // Excel y PDF comparten la misma "sección" (cabeceras + filas numéricas);
  // el CSV existente se deja tal cual, solo se mueve dentro del menú.

  const filterLabel = { dia: 'Hoy', semana: 'Esta semana', mes: 'Este mes', año: 'Este año', custom: 'Personalizado' }[dateFilter]
  const restLabel = restFilter === 'todos' ? 'Todos los restaurantes' : (restaurants.find(r => r.id === restFilter)?.name ?? '')
  const reportSubtitle = `${filterLabel}${dateFilter === 'custom' && dateFrom && dateTo ? ` (${dateFrom} a ${dateTo})` : ''} · ${restLabel}`

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

  function periodoSections(): ReportSection[] {
    const { periods, restNames, cell, rowTotal, colTotal, grandTotal } = periodoTable
    return [{
      heading: 'Gasto por período',
      headers: ['Restaurante', ...periods, 'TOTAL'],
      rows: [
        ...restNames.map(r => [
          r,
          ...periods.map(p => Number((cell[r]?.[p]?.euros ?? 0).toFixed(2))),
          Number(rowTotal[r].toFixed(2)),
        ]),
        ['TOTAL', ...periods.map(p => Number(colTotal[p].toFixed(2))), Number(grandTotal.toFixed(2))],
      ],
    }]
  }

  function exportProductos() {
    const { products, restNames } = productoTable
    const headers = ['Producto', 'Unidad', ...restNames, 'Total €']
    if (showMargin) headers.push('Margen %', 'Margen €/ud')
    const rows = products.map(p => {
      const totalEuros = restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0)
      const row: (string | number)[] = [
        p.name, p.unit,
        ...restNames.map(r => p.byRest[r]?.qty.toFixed(2) ?? '0'),
        totalEuros.toFixed(2),
      ]
      if (showMargin) {
        row.push(p.marginPct != null ? p.marginPct.toFixed(1) : 'Sin coste', p.unitMargin != null ? p.unitMargin.toFixed(3) : 'Sin coste')
      }
      return row
    })
    exportCSV(headers, rows, 'estadisticas-productos.csv')
  }

  function productosSections(): ReportSection[] {
    const { products, restNames } = productoTable
    return [{
      heading: 'Consumo por producto',
      headers: ['Producto', 'Unidad', ...restNames, 'Total €'],
      rows: products.map(p => [
        p.name, unitLabel(p.unit),
        ...restNames.map(r => Number((p.byRest[r]?.qty ?? 0).toFixed(2))),
        Number(restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0).toFixed(2)),
      ]),
    }]
  }

  function productosMarginSections(): ReportSection[] {
    const { products, restNames } = productoTable
    return [{
      heading: 'Consumo por producto (con margen)',
      headers: ['Producto', 'Unidad', ...restNames, 'Total €', 'Margen %', 'Margen €/ud', 'Coste registrado'],
      rows: products.map(p => {
        const totalEuros = restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0)
        return [
          p.name, unitLabel(p.unit),
          ...restNames.map(r => Number((p.byRest[r]?.qty ?? 0).toFixed(2))),
          Number(totalEuros.toFixed(2)),
          p.marginPct != null ? Number(p.marginPct.toFixed(1)) : 'Sin coste',
          p.unitMargin != null ? Number(p.unitMargin.toFixed(3)) : 'Sin coste',
          p.eurosWithCost > 0 ? `${((p.eurosWithCost / totalEuros) * 100).toFixed(0)}%` : '0%',
        ]
      }),
    }]
  }

  function rankingSections(): ReportSection[] {
    return [
      {
        heading: 'Restaurantes por gasto',
        headers: ['#', 'Restaurante', 'Pedidos', 'Gasto total €'],
        rows: ranking.rests.map((r, i) => [i + 1, r.name, r.pedidos.size, Number(r.euros.toFixed(2))]),
      },
      {
        heading: 'Productos más consumidos',
        headers: ['#', 'Producto', 'Cantidad', 'Unidad', 'Gasto total €'],
        rows: ranking.prods.map((p, i) => [i + 1, p.name, Number(p.qty.toFixed(2)), unitLabel(p.unit), Number(p.euros.toFixed(2))]),
      },
    ]
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
        {([['resumen','Resumen'],['periodo','Por período'],['productos','Por producto'],['ranking','Ranking']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              tab === k ? 'bg-white text-black shadow-sm' : 'text-gray-700 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {hasPreviousPeriod ? 'Comparado con el período equivalente anterior.' : 'No hay datos del período anterior para comparar.'}
            </p>
            <button
              onClick={() => exportExecutiveSummaryPDF({
                subtitle: reportSubtitle,
                kpis: [
                  { label: 'Gasto total', value: `${currentSummary.euros.toFixed(0)}€`, trend: pctChange(currentSummary.euros, previousSummary.euros) },
                  { label: 'Pedidos', value: String(currentSummary.pedidos), trend: pctChange(currentSummary.pedidos, previousSummary.pedidos) },
                  { label: 'Ticket medio', value: `${currentSummary.ticketMedio.toFixed(2)}€`, trend: pctChange(currentSummary.ticketMedio, previousSummary.ticketMedio) },
                  { label: 'Restaurantes activos', value: String(currentSummary.restaurantes), trend: null },
                ],
                alerts: alerts.map(a => a.text),
                topRestaurantes: ranking.rests.slice(0, 8).map(r => ({ name: r.name, euros: r.euros, pedidos: r.pedidos.size })),
                topProductos: ranking.prods.slice(0, 8).map(p => {
                  const pt = productoTable.products.find(x => x.id === p.id)
                  const unitMargin = pt && pt.qtyWithCost > 0 ? (pt.netRevenueWithCost - pt.costTotal) / pt.qtyWithCost : null
                  return { name: p.name, euros: p.euros, qty: p.qty, unit: p.unit, unitMargin }
                }),
              }, 'informe-ejecutivo.pdf')}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1E2B28] text-white hover:bg-[#141F1C] transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" /> Generar informe ejecutivo (PDF)
            </button>
          </div>

          {/* KPIs con tendencia */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Gasto total', value: `${currentSummary.euros.toFixed(0)}€`, trend: pctChange(currentSummary.euros, previousSummary.euros) },
              { label: 'Pedidos', value: String(currentSummary.pedidos), trend: pctChange(currentSummary.pedidos, previousSummary.pedidos) },
              { label: 'Ticket medio', value: `${currentSummary.ticketMedio.toFixed(2)}€`, trend: pctChange(currentSummary.ticketMedio, previousSummary.ticketMedio) },
              {
                label: 'Margen medio',
                value: marginSummary.marginPct != null ? `${marginSummary.marginPct.toFixed(0)}%` : '—',
                trend: null,
                hint: marginSummary.marginPct != null ? `sobre ${marginSummary.coverage.toFixed(0)}% de la facturación con coste registrado` : 'ningún producto de este período tiene coste registrado',
              },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-600">{k.label}</p>
                <div className="flex items-end justify-between mt-0.5">
                  <p className="text-xl sm:text-2xl font-bold text-black">{k.value}</p>
                  {k.trend != null && (
                    <span className={`flex items-center gap-0.5 text-xs font-semibold ${k.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {k.trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {Math.abs(k.trend).toFixed(0)}%
                    </span>
                  )}
                </div>
                {'hint' in k && k.hint && <p className="text-[10px] text-gray-500 mt-1 leading-tight">{k.hint}</p>}
              </div>
            ))}
          </div>

          {/* Gráfico de evolución */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-black">Evolución de ventas</h2>
              <span className="text-xs text-gray-600">{restFilter === 'todos' ? 'Todos los restaurantes' : restLabel} · últimos {evolutionData.length} {groupBy === 'mes' ? 'meses' : 'semanas'}</span>
            </div>
            {evolutionData.length === 0 ? (
              <p className="text-center py-10 text-gray-600 text-sm">Sin datos suficientes todavía</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={evolutionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="euroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B4332" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1B4332" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0ee" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={((value: any, name: any) => [name === 'euros' ? `${value}€` : value, name === 'euros' ? 'Gasto' : 'Pedidos']) as any}
                    contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="euros" stroke="#1B4332" strokeWidth={2} fill="url(#euroGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Alertas */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-black">Cosas a tener en cuenta</h2>
              </div>
              {alerts.length === 0 ? (
                <p className="text-center py-8 text-gray-600 text-sm">Sin novedades destacables en este período</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2.5 px-4 py-3 text-sm ${a.level === 'warn' ? 'bg-amber-50/50' : ''}`}>
                      {a.level === 'warn'
                        ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        : <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />}
                      <span className="text-black">{a.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cruce ventas × stock */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-black flex items-center gap-1.5">
                  <PackageX className="w-4 h-4 text-red-500" /> Se vende bien y queda poco stock
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">Para decidir qué reponer antes de quedarte sin ello</p>
              </div>
              {stockCrossRef.length === 0 ? (
                <p className="text-center py-8 text-gray-600 text-sm">Nada que avisar — el stock cubre lo que se está vendiendo</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {stockCrossRef.map(r => (
                    <div key={r.productId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-black truncate">{r.name}</p>
                        <p className="text-xs text-gray-600">Vendido: {r.qty % 1 === 0 ? r.qty : r.qty.toFixed(1)} {unitLabel(r.unit)} · {r.euros.toFixed(0)}€</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${r.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.stock === 0 ? 'Agotado' : `Quedan ${r.stock}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Margen atrapado en stock */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-black">Beneficio potencial en el stock actual</h2>
              <p className="text-xs text-gray-600 mt-0.5">Si vendieras hoy todo lo que tienes, al margen habitual de cada producto</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">Coste de ese stock</p>
                  <p className="text-lg font-bold text-black">{stockMarginValue.totalCost.toFixed(0)}€</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">Beneficio si se vende todo</p>
                  <p className={`text-lg font-bold ${stockMarginValue.total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {stockMarginValue.total.toFixed(0)}€
                    {stockMarginValue.totalCost + stockMarginValue.total > 0 && (
                      <span className="text-xs font-medium ml-1">
                        ({((stockMarginValue.total / (stockMarginValue.totalCost + stockMarginValue.total)) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            {stockMarginValue.topPositive.length === 0 ? (
              <p className="text-center py-8 text-gray-600 text-sm">No hay suficientes productos con coste y stock para calcularlo</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="divide-y divide-gray-50 sm:border-r sm:border-gray-50">
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Más beneficio parado</p>
                  {stockMarginValue.topPositive.map(r => (
                    <div key={r.productId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-black truncate">{r.name}</p>
                        <p className="text-xs text-gray-600">{r.stock} {unitLabel(r.unit)} en stock · {r.unitMargin.toFixed(2)}€/ud</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${r.stockValue >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {r.stockValue.toFixed(0)}€
                        </p>
                        {r.marginPct != null && <p className="text-[10px] text-gray-500">{r.marginPct.toFixed(0)}%</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-gray-50">
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Stock que pierde dinero</p>
                  {stockMarginValue.negative.length === 0 ? (
                    <p className="text-center py-6 text-gray-500 text-xs">Ninguno — todo el stock con coste registrado tiene margen positivo</p>
                  ) : (
                    stockMarginValue.negative.map(r => (
                      <div key={r.productId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-black truncate">{r.name}</p>
                          <p className="text-xs text-gray-600">{r.stock} {unitLabel(r.unit)} en stock · {r.unitMargin.toFixed(2)}€/ud</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-red-500">{r.stockValue.toFixed(0)}€</p>
                          {r.marginPct != null && <p className="text-[10px] text-red-400">{r.marginPct.toFixed(0)}%</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PERÍODO ─────────────────────────────────────────────────── */}
      {tab === 'periodo' && (() => {
        const { periods, restNames, cell, colMax, rowTotal, colTotal, grandTotal, maxTotal } = periodoTable
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">Las celdas más oscuras = mayor gasto. Mueve la tabla horizontalmente si no caben todas las columnas.</p>
              <ExportMenu
                onExcel={() => exportReportExcel(periodoSections(), 'estadisticas-periodo.xlsx')}
                onPDF={() => exportReportPDF('Gasto por período', reportSubtitle, periodoSections(), 'estadisticas-periodo.pdf')}
                onCSV={exportPeriodo}
              />
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
        const { products, restNames, restMax, marginCounts } = productoTable
        return (
          <div className="space-y-2">
            <UnitConverter />
            <div className="flex flex-wrap items-center gap-3">
              <input type="text" placeholder="Buscar producto..." value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2B28] w-52" />
              <p className="text-xs text-gray-600 flex-1">Cantidades pedidas por restaurante. Celdas oscuras = mayor consumo. Pulsa un producto para ver el ranking.</p>
              <button
                onClick={() => { setShowMargin(v => !v); setMarginFilter('todos') }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  showMargin ? 'bg-[#1E2B28] text-white border-[#1E2B28]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Ver margen
              </button>
              <ExportMenu
                onExcel={() => exportReportExcel(showMargin ? productosMarginSections() : productosSections(), 'estadisticas-productos.xlsx')}
                onPDF={() => exportReportPDF('Consumo por producto', reportSubtitle, showMargin ? productosMarginSections() : productosSections(), 'estadisticas-productos.pdf')}
                onCSV={exportProductos}
              />
            </div>
            {showMargin && (
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: 'todos' as const, label: `Todos (${marginCounts.verde + marginCounts.naranja + marginCounts.rojo + marginCounts.sinCoste})`, dot: null },
                  { key: 'verde' as const, label: `Verde (${marginCounts.verde})`, dot: 'bg-green-500' },
                  { key: 'naranja' as const, label: `Naranja (${marginCounts.naranja})`, dot: 'bg-amber-500' },
                  { key: 'rojo' as const, label: `Rojo (${marginCounts.rojo})`, dot: 'bg-red-500' },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setMarginFilter(f.key)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                      marginFilter === f.key ? 'bg-[#1E2B28] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
                    {f.label}
                  </button>
                ))}
                {marginCounts.sinCoste > 0 && (
                  <span className="text-xs text-gray-500 self-center">· {marginCounts.sinCoste} sin coste registrado</span>
                )}
              </div>
            )}
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
                      {showMargin && <th className="text-right px-4 py-3 text-xs text-gray-700 font-semibold min-w-[90px]">Margen</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllProducts ? products : products.slice(0, 8)).map(p => {
                      const totalEuros = restNames.reduce((s, r) => s + (p.byRest[r]?.euros ?? 0), 0)
                      const { marginPct, unitMargin } = p
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
                            {showMargin && (
                              <td className="px-4 py-3 text-right">
                                {marginPct != null ? (
                                  <>
                                    <p className={`font-semibold text-sm ${marginPct >= 40 ? 'text-green-600' : marginPct >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
                                      {marginPct.toFixed(0)}%
                                    </p>
                                    {unitMargin != null && (
                                      <p className="text-[10px] text-gray-500">{unitMargin.toFixed(2)}€/{unitLabel(p.unit)}</p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-gray-400">sin coste</p>
                                )}
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr className="bg-[#1E2B28]/[0.03] border-b border-gray-100">
                              <td colSpan={restNames.length + (showMargin ? 3 : 2)} className="px-4 py-4">
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
            {products.length > 8 && (
              <button
                onClick={() => setShowAllProducts(v => !v)}
                className="w-full text-center text-xs font-medium text-[#1E2B28] bg-white border border-gray-100 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
              >
                {showAllProducts ? 'Ver menos' : `Ver los ${products.length - 8} productos restantes`}
              </button>
            )}
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
        <div className="space-y-3">
          <div className="flex justify-end">
            <ExportMenu
              onExcel={() => exportReportExcel(rankingSections(), 'estadisticas-ranking.xlsx')}
              onPDF={() => exportReportPDF('Ranking', reportSubtitle, rankingSections(), 'estadisticas-ranking.pdf')}
            />
          </div>
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
        </div>
      )}
    </div>
  )
}
