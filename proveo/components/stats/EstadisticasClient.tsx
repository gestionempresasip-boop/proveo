'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, PieChart, Pie
} from 'recharts'
import { Download, ChevronDown, TrendingUp, ShoppingCart, Package, Euro } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type OrderLine = {
  order_id: string
  order_number: number
  created_at: string
  restaurant_id: string
  restaurant_name: string
  product_id: string
  product_name: string
  quantity: number
  unit: string
  unit_price: number
  item_total: number
  order_total: number
}

type Restaurant = { id: string; name: string }

type DateFilter = 'semana' | 'mes' | 'año' | 'custom'

// ── Palette ──────────────────────────────────────────────────────────────────

const PALETTE = ['#1B4332','#F59E0B','#2d6a4f','#d97706','#40916c','#b45309','#74c69d','#fcd34d','#52b788','#fbbf24']

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOf(unit: 'week' | 'month' | 'year') {
  const d = new Date()
  if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0) }
  if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0) }
  if (unit === 'year') { d.setMonth(0,1); d.setHours(0,0,0,0) }
  return d
}

function fmtMonth(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}
function fmtWeek(dateStr: string) {
  const d = new Date(dateStr)
  const week = Math.ceil((d.getDate()) / 7)
  return `S${week} ${d.toLocaleDateString('es-ES',{month:'short'})}`
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(rows: OrderLine[], label: string) {
  const header = 'Restaurante,Producto,Cantidad,Unidad,Precio ud.,Total línea,Fecha pedido,Nº pedido'
  const lines = rows.map(r => [
    `"${r.restaurant_name}"`, `"${r.product_name}"`,
    r.quantity, r.unit, Number(r.unit_price).toFixed(2),
    Number(r.item_total).toFixed(2),
    new Date(r.created_at).toLocaleDateString('es-ES'), r.order_number
  ].join(','))
  const csv = [header, ...lines].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `estadisticas_${label}.csv`
  a.click()
}

// ── Tooltip custom ────────────────────────────────────────────────────────────

function EuroTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-[#1C1C1E] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">
          {p.name}: <strong>{Number(p.value).toFixed(2)}€</strong>
        </p>
      ))}
    </div>
  )
}

function QtyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-[#1C1C1E] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">
          {p.name}: <strong>{Number(p.value).toLocaleString('es-ES', { maximumFractionDigits: 2 })}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function EstadisticasClient({ lines, restaurants }: { lines: OrderLine[]; restaurants: Restaurant[] }) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [restFilter, setRestFilter] = useState('todos')
  const [tab, setTab] = useState<'resumen' | 'productos' | 'frecuencia'>('resumen')

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const map: Record<DateFilter, Date | null> = {
      semana: startOf('week'), mes: startOf('month'), año: startOf('year'), custom: null
    }
    return lines.filter(l => {
      const d = new Date(l.created_at)
      let passDate = true
      if (dateFilter === 'custom') {
        const from = dateFrom ? new Date(dateFrom) : null
        const to = dateTo ? new Date(new Date(dateTo).getTime() + 86399999) : null
        passDate = (!from || d >= from) && (!to || d <= to)
      } else {
        const since = map[dateFilter]
        passDate = since ? d >= since : true
      }
      const passRest = restFilter === 'todos' || l.restaurant_id === restFilter
      return passDate && passRest
    })
  }, [lines, dateFilter, dateFrom, dateTo, restFilter])

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const uniqueOrders = useMemo(() => new Set(filtered.map(l => l.order_id)), [filtered])
  const totalEuros = useMemo(() => {
    const seen = new Set<string>()
    return filtered.reduce((s, l) => { if (!seen.has(l.order_id)) { seen.add(l.order_id); return s + l.order_total } return s }, 0)
  }, [filtered])
  const uniqueProducts = useMemo(() => new Set(filtered.map(l => l.product_id)).size, [filtered])
  const activeRests = useMemo(() => new Set(filtered.map(l => l.restaurant_id)).size, [filtered])

  // ── Chart: gasto por restaurante ─────────────────────────────────────────

  const spendByRest = useMemo(() => {
    const map: Record<string, { name: string; total: number; pedidos: number }> = {}
    const seen = new Set<string>()
    filtered.forEach(l => {
      if (!map[l.restaurant_id]) map[l.restaurant_id] = { name: l.restaurant_name, total: 0, pedidos: 0 }
      if (!seen.has(l.order_id)) {
        seen.add(l.order_id)
        map[l.restaurant_id].total += l.order_total
        map[l.restaurant_id].pedidos++
      }
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtered])

  // ── Chart: top productos ─────────────────────────────────────────────────

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; euros: number; veces: number }> = {}
    filtered.forEach(l => {
      if (!map[l.product_id]) map[l.product_id] = { name: l.product_name, qty: 0, euros: 0, veces: 0 }
      map[l.product_id].qty += l.quantity
      map[l.product_id].euros += l.item_total
      map[l.product_id].veces++
    })
    return Object.values(map).sort((a, b) => b.euros - a.euros).slice(0, 15)
  }, [filtered])

  // ── Chart: gasto por mes/semana (línea temporal) ─────────────────────────

  const timeline = useMemo(() => {
    const fmt = dateFilter === 'semana' ? fmtWeek : fmtMonth
    const map: Record<string, Record<string, number>> = {}
    const seen = new Set<string>()
    filtered.forEach(l => {
      const key = fmt(l.created_at)
      if (!map[key]) map[key] = {}
      if (!seen.has(l.order_id + key)) {
        seen.add(l.order_id + key)
        map[key][l.restaurant_name] = (map[key][l.restaurant_name] ?? 0) + l.order_total
      }
    })
    const restNames = [...new Set(filtered.map(l => l.restaurant_name))]
    return { data: Object.entries(map).map(([k, v]) => ({ periodo: k, ...v })), restNames }
  }, [filtered, dateFilter])

  // ── Chart: producto × restaurante ────────────────────────────────────────

  const prodByRest = useMemo(() => {
    if (restFilter !== 'todos') {
      // Single restaurant: show all products
      const map: Record<string, { name: string; qty: number }> = {}
      filtered.forEach(l => {
        if (!map[l.product_id]) map[l.product_id] = { name: l.product_name, qty: 0 }
        map[l.product_id].qty += l.quantity
      })
      return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 20)
        .map(p => ({ product: p.name, cantidad: p.qty }))
    }
    // All restaurants: matrix top 10 products × each restaurant
    const topProds = topProducts.slice(0, 10).map(p => p.name)
    const restNames = [...new Set(filtered.map(l => l.restaurant_name))]
    const matrix = topProds.map(prod => {
      const row: any = { product: prod.length > 20 ? prod.substring(0, 18) + '…' : prod }
      restNames.forEach(r => { row[r] = 0 })
      filtered.filter(l => l.product_name === prod).forEach(l => { row[l.restaurant_name] = (row[l.restaurant_name] ?? 0) + l.quantity })
      return row
    })
    return { matrix, restNames }
  }, [filtered, restFilter, topProducts])

  // ── Chart: frecuencia de pedidos ─────────────────────────────────────────

  const frequency = useMemo(() => {
    const map: Record<string, { name: string; pedidos: number; diasEntreOrders: number[]; ultimoPedido: string }> = {}
    const ordersByRest: Record<string, string[]> = {}
    const seen = new Set<string>()
    filtered.forEach(l => {
      if (!ordersByRest[l.restaurant_id]) ordersByRest[l.restaurant_id] = []
      if (!seen.has(l.order_id + l.restaurant_id)) {
        seen.add(l.order_id + l.restaurant_id)
        ordersByRest[l.restaurant_id].push(l.created_at)
        if (!map[l.restaurant_id]) map[l.restaurant_id] = { name: l.restaurant_name, pedidos: 0, diasEntreOrders: [], ultimoPedido: l.created_at }
        map[l.restaurant_id].pedidos++
        if (new Date(l.created_at) > new Date(map[l.restaurant_id].ultimoPedido))
          map[l.restaurant_id].ultimoPedido = l.created_at
      }
    })
    return Object.values(map).map(r => {
      const dates = (ordersByRest[Object.keys(ordersByRest).find(k => map[k]?.name === r.name) ?? ''] ?? [])
        .sort().map(d => new Date(d).getTime())
      const gaps = dates.slice(1).map((d, i) => (d - dates[i]) / 86400000)
      const avgDays = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null
      return {
        name: r.name,
        pedidos: r.pedidos,
        cadencia: avgDays ? `${Math.round(avgDays)} días` : 'sin datos',
        cadenciaDias: avgDays ? Math.round(avgDays) : 0,
        ultimo: new Date(r.ultimoPedido).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      }
    }).sort((a, b) => b.pedidos - a.pedidos)
  }, [filtered])

  const periodLabel = { semana: 'esta-semana', mes: 'este-mes', año: 'este-año', custom: `${dateFrom}_${dateTo}` }[dateFilter]

  const isMatrix = restFilter === 'todos' && typeof prodByRest === 'object' && 'matrix' in prodByRest

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Estadísticas</h1>
          <p className="text-gray-500 text-sm mt-1">Consumo por restaurante, productos y frecuencia</p>
        </div>
        <button
          onClick={() => exportCSV(filtered, periodLabel)}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Date tabs */}
        <div className="flex border-b border-gray-100">
          {([['semana','Semana'],['mes','Mes'],['año','Año'],['custom','Personalizado']] as [DateFilter,string][]).map(([k,l]) => (
            <button key={k} onClick={() => setDateFilter(k)}
              className={`flex-1 py-3 text-xs sm:text-sm font-medium transition-colors ${
                dateFilter === k ? 'bg-[#1B4332] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          {dateFilter === 'custom' && (
            <>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-gray-400 block mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs text-gray-400 block mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332]" />
              </div>
            </>
          )}
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-400 block mb-1">Restaurante</label>
            <div className="relative">
              <select value={restFilter} onChange={e => setRestFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4332] appearance-none pr-8">
                <option value="todos">Todos los restaurantes</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pedidos', value: uniqueOrders.size, icon: ShoppingCart, color: 'bg-amber-50 text-amber-600', fmt: (v: number) => v },
          { label: 'Gasto total', value: totalEuros, icon: Euro, color: 'bg-green-50 text-[#1B4332]', fmt: (v: number) => `${v.toFixed(2)}€` },
          { label: 'Productos distintos', value: uniqueProducts, icon: Package, color: 'bg-blue-50 text-blue-600', fmt: (v: number) => v },
          { label: 'Restaurantes activos', value: activeRests, icon: TrendingUp, color: 'bg-purple-50 text-purple-600', fmt: (v: number) => v },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">{s.fmt(s.value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['resumen','Resumen'],['productos','Productos'],['frecuencia','Frecuencia']] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === k ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >{l}</button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          {/* Gasto por restaurante */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-[#1C1C1E] mb-4">Gasto por restaurante</h2>
            {spendByRest.length === 0
              ? <p className="text-gray-400 text-sm text-center py-8">Sin datos para este período</p>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={spendByRest} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} width={56} />
                    <Tooltip content={<EuroTooltip />} />
                    <Bar dataKey="total" name="Total €" radius={[6,6,0,0]}>
                      {spendByRest.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Tabla resumen restaurantes */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-[#1C1C1E]">Detalle por restaurante</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Restaurante</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Pedidos</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Total gastado</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Media / pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {spendByRest.map((r, i) => (
                    <tr key={r.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-[#1C1C1E] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {r.name}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{r.pedidos}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#1B4332]">{r.total.toFixed(2)}€</td>
                      <td className="px-5 py-3 text-right text-gray-500">{(r.total / r.pedidos).toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {spendByRest.length === 0 && <p className="text-center py-10 text-gray-400">Sin datos</p>}
            </div>
          </div>

          {/* Evolución temporal */}
          {timeline.data.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-[#1C1C1E] mb-4">Evolución del gasto</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeline.data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} width={56} />
                  <Tooltip content={<EuroTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {timeline.restNames.map((r, i) => (
                    <Line key={r} type="monotone" dataKey={r} stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PRODUCTOS ───────────────────────────────────────────────── */}
      {tab === 'productos' && (
        <div className="space-y-6">
          {/* Top productos por importe */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-[#1C1C1E] mb-4">
              {restFilter === 'todos' ? 'Top 15 productos más pedidos (€)' : 'Productos pedidos por este restaurante'}
            </h2>
            {topProducts.length === 0
              ? <p className="text-gray-400 text-sm text-center py-8">Sin datos para este período</p>
              : (
                <ResponsiveContainer width="100%" height={Math.max(260, topProducts.length * 32)}>
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip content={<EuroTooltip />} />
                    <Bar dataKey="euros" name="Total €" radius={[0,6,6,0]}>
                      {topProducts.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Cantidad pedida por producto × restaurante */}
          {isMatrix && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-[#1C1C1E] mb-1">Cantidad pedida por restaurante (top 10 productos)</h2>
              <p className="text-xs text-gray-400 mb-4">En unidades de cada producto</p>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={(prodByRest as any).matrix} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="product" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip content={<QtyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {(prodByRest as any).restNames.map((r: string, i: number) => (
                    <Bar key={r} dataKey={r} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === (prodByRest as any).restNames.length - 1 ? [4,4,0,0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Single restaurant: bar chart de cantidades */}
          {!isMatrix && restFilter !== 'todos' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-[#1C1C1E] mb-4">Cantidad pedida de cada producto</h2>
              <ResponsiveContainer width="100%" height={Math.max(260, (prodByRest as any).length * 32)}>
                <BarChart data={prodByRest as any} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="product" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip content={<QtyTooltip />} />
                  <Bar dataKey="cantidad" name="Cantidad" fill="#1B4332" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla detalle productos */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-[#1C1C1E]">Tabla detalle de productos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Producto</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Veces pedido</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Cantidad total</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Total €</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topProducts.map((p, i) => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-[#1C1C1E] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {p.name}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{p.veces}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{p.qty.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[#1B4332]">{p.euros.toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topProducts.length === 0 && <p className="text-center py-10 text-gray-400">Sin datos</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: FRECUENCIA ──────────────────────────────────────────────── */}
      {tab === 'frecuencia' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-[#1C1C1E] mb-4">Número de pedidos por restaurante</h2>
            {frequency.length === 0
              ? <p className="text-gray-400 text-sm text-center py-8">Sin datos para este período</p>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={frequency} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                    <Tooltip />
                    <Bar dataKey="pedidos" name="Pedidos" radius={[6,6,0,0]}>
                      {frequency.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Tabla frecuencia */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-[#1C1C1E]">Cadencia de pedidos por restaurante</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Restaurante</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Pedidos</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Cada (media)</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Último pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {frequency.map((r, i) => (
                    <tr key={r.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-[#1C1C1E] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {r.name}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-[#1B4332]">{r.pedidos}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{r.cadencia}</td>
                      <td className="px-5 py-3 text-right text-gray-400">{r.ultimo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {frequency.length === 0 && <p className="text-center py-10 text-gray-400">Sin datos</p>}
            </div>
          </div>

          {/* Pie: proporción de pedidos */}
          {frequency.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-[#1C1C1E] mb-4">Proporción de pedidos por restaurante</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={frequency} dataKey="pedidos" nameKey="name" cx="50%" cy="50%"
                      outerRadius={90} label={({ name, percent }: { name?: string; percent?: number }) => `${(name ?? '').split(' ')[0]} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {frequency.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} pedidos`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 min-w-[160px]">
                  {frequency.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="text-gray-700 truncate">{r.name}</span>
                      <span className="ml-auto font-semibold text-[#1B4332] shrink-0">{r.pedidos}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
