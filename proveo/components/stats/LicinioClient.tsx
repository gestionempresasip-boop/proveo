'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Store, Package, ClipboardList, CalendarDays, LayoutDashboard } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { unitLabel } from '@/lib/units'

type Line = {
  order_id: string; order_number: number; created_at: string
  restaurant_id: string; restaurant_name: string
  product_id: string; product_name: string
  quantity: number; unit: string; item_total: number
}
type Restaurant = { id: string; name: string }
type View = 'semana' | 'dashboard'

const BARS = ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC']

// Lunes 00:00 de la semana que contiene `d` (semana laboral, no la de EEUU).
function mondayOf(d: Date) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}
function sundayOf(monday: Date) {
  const s = new Date(monday)
  s.setDate(s.getDate() + 6)
  s.setHours(23, 59, 59, 999)
  return s
}
function weekLabel(monday: Date) {
  const sunday = sundayOf(monday)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const dd = (d: Date) => d.getDate()
  const mm = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' })
  return sameMonth
    ? `${dd(monday)} - ${dd(sunday)} ${mm(sunday)} ${sunday.getFullYear()}`
    : `${dd(monday)} ${mm(monday)} - ${dd(sunday)} ${mm(sunday)} ${sunday.getFullYear()}`
}
function weekKey(monday: Date) {
  return monday.toISOString().slice(0, 10)
}
// Etiqueta compacta para el eje del gráfico (no cabe la versión larga de weekLabel).
function weekShortLabel(monday: Date) {
  const sunday = sundayOf(monday)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const mm = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' })
  return sameMonth
    ? `${monday.getDate()}-${sunday.getDate()} ${mm(sunday)}`
    : `${monday.getDate()} ${mm(monday)}-${sunday.getDate()} ${mm(sunday)}`
}
function fmtQty(q: number) {
  return q.toFixed(q % 1 === 0 ? 0 : 2)
}

export function LicinioClient({ lines, restaurants }: { lines: Line[]; restaurants: Restaurant[] }) {
  const [view, setView] = useState<View>('semana')
  const [weekOffset, setWeekOffset] = useState(0) // 0 = semana actual, -1 = la anterior...
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [scopeRestaurantId, setScopeRestaurantId] = useState<string>('todos')

  // ── Vista semana a semana ─────────────────────────────────────────────
  const currentMonday = useMemo(() => {
    const m = mondayOf(new Date())
    m.setDate(m.getDate() + weekOffset * 7)
    return m
  }, [weekOffset])
  const currentSunday = useMemo(() => sundayOf(currentMonday), [currentMonday])

  const weekLines = useMemo(() => {
    return lines.filter(l => {
      const d = new Date(l.created_at)
      return d >= currentMonday && d <= currentSunday
    })
  }, [lines, currentMonday, currentSunday])

  const byRestaurantWeek = useMemo(() => {
    return restaurants.map(r => {
      const rLines = weekLines.filter(l => l.restaurant_id === r.id)
      const orderIds = new Set(rLines.map(l => l.order_id))
      const totalImporte = rLines.reduce((s, l) => s + l.item_total, 0)

      const byProduct = new Map<string, { name: string; unit: string; quantity: number; importe: number }>()
      for (const l of rLines) {
        const cur = byProduct.get(l.product_id) ?? { name: l.product_name, unit: l.unit, quantity: 0, importe: 0 }
        cur.quantity += l.quantity
        cur.importe += l.item_total
        byProduct.set(l.product_id, cur)
      }
      const products = [...byProduct.values()].sort((a, b) => b.quantity - a.quantity)

      return { id: r.id, name: r.name, pedidos: orderIds.size, totalImporte, products }
    }).sort((a, b) => b.totalImporte - a.totalImporte)
  }, [weekLines, restaurants])

  function toggle(id: string) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  // ── Vista dashboard (evolución) ───────────────────────────────────────
  const NUM_WEEKS = 12
  const scopedLines = useMemo(
    () => scopeRestaurantId === 'todos' ? lines : lines.filter(l => l.restaurant_id === scopeRestaurantId),
    [lines, scopeRestaurantId]
  )

  const evolutionData = useMemo(() => {
    const thisMonday = mondayOf(new Date())
    const weeks: { monday: Date; key: string; label: string }[] = []
    for (let i = NUM_WEEKS - 1; i >= 0; i--) {
      const m = new Date(thisMonday)
      m.setDate(m.getDate() - i * 7)
      weeks.push({ monday: m, key: weekKey(m), label: weekShortLabel(m) })
    }
    const byWeek = new Map<string, { pedidos: Set<string>; euros: number }>()
    for (const w of weeks) byWeek.set(w.key, { pedidos: new Set(), euros: 0 })
    for (const l of scopedLines) {
      const mk = weekKey(mondayOf(new Date(l.created_at)))
      const bucket = byWeek.get(mk)
      if (!bucket) continue
      bucket.pedidos.add(l.order_id)
      bucket.euros += l.item_total
    }
    return weeks.map(w => ({
      periodo: w.label,
      pedidos: byWeek.get(w.key)!.pedidos.size,
      euros: Math.round(byWeek.get(w.key)!.euros),
    }))
  }, [scopedLines])

  const topProductsDashboard = useMemo(() => {
    const byProduct = new Map<string, { name: string; unit: string; quantity: number }>()
    for (const l of scopedLines) {
      const cur = byProduct.get(l.product_id) ?? { name: l.product_name, unit: l.unit, quantity: 0 }
      cur.quantity += l.quantity
      byProduct.set(l.product_id, cur)
    }
    return [...byProduct.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8)
      .map(p => ({ name: p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name, cantidad: Number(p.quantity.toFixed(2)), unit: p.unit }))
  }, [scopedLines])

  const dashboardKpis = useMemo(() => {
    const orderIds = new Set(scopedLines.map(l => l.order_id))
    const euros = scopedLines.reduce((s, l) => s + l.item_total, 0)
    return { pedidos: orderIds.size, euros, ticket: orderIds.size ? euros / orderIds.size : 0 }
  }, [scopedLines])

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-black">Licinio informe</h1>
          <p className="text-gray-600 text-sm mt-0.5">Qué pide cada restaurante y cómo evoluciona</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('semana')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'semana' ? 'bg-white text-black shadow-sm' : 'text-gray-600'}`}
          >
            <CalendarDays className="w-4 h-4" /> Semana
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-white text-black shadow-sm' : 'text-gray-600'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>

      {view === 'semana' ? (
        <>
          {/* Navegador de semanas */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
            <button onClick={() => setWeekOffset(o => o - 1)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="font-semibold text-black">{weekLabel(currentMonday)}</p>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} className="text-xs text-[#1E2B28] underline mt-0.5">Ir a esta semana</button>
              )}
            </div>
            <button onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0} className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tarjetas por restaurante, semana concreta */}
          {byRestaurantWeek.length === 0 ? (
            <p className="text-center py-12 text-gray-600">No hay restaurantes</p>
          ) : (
            <div className="space-y-4">
              {byRestaurantWeek.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1E2B28]/5 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-[#1E2B28]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-black truncate">{r.name}</p>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5" /> {r.pedidos} pedido{r.pedidos !== 1 ? 's' : ''} · {r.totalImporte.toFixed(2)}€
                      </p>
                    </div>
                    {r.products.length > 6 && (
                      <button onClick={() => toggle(r.id)} className="shrink-0 text-gray-600 hover:text-black">
                        {expanded[r.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    )}
                  </div>

                  {r.products.length === 0 ? (
                    <p className="px-4 pb-4 text-sm text-gray-600">Sin pedidos esta semana</p>
                  ) : (
                    <div className="border-t border-gray-50 p-4">
                      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-2">
                        <Package className="w-3.5 h-3.5" /> Productos pedidos
                      </p>
                      <div className="space-y-1.5">
                        {(expanded[r.id] ? r.products : r.products.slice(0, 6)).map(p => (
                          <div key={p.name} className="flex items-center justify-between text-sm">
                            <span className="text-black truncate pr-2">{p.name}</span>
                            <span className="text-gray-600 shrink-0 font-medium">{fmtQty(p.quantity)} {unitLabel(p.unit)} · {p.importe.toFixed(2)}€</span>
                          </div>
                        ))}
                      </div>
                      {!expanded[r.id] && r.products.length > 6 && (
                        <button onClick={() => toggle(r.id)} className="text-xs text-[#1E2B28] underline mt-2">
                          Ver los {r.products.length - 6} restantes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Selector de restaurante para el dashboard */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setScopeRestaurantId('todos')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${scopeRestaurantId === 'todos' ? 'bg-[#1E2B28] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Todos
              </button>
              {restaurants.map(r => (
                <button
                  key={r.id}
                  onClick={() => setScopeRestaurantId(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${scopeRestaurantId === r.id ? 'bg-[#1E2B28] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pedidos (histórico)', value: String(dashboardKpis.pedidos) },
              { label: 'Gasto total', value: `${dashboardKpis.euros.toFixed(0)}€` },
              { label: 'Ticket medio', value: `${dashboardKpis.ticket.toFixed(2)}€` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-600">{k.label}</p>
                <p className="text-lg sm:text-xl font-bold text-black mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Evolución semanal */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-black">Evolución semanal</h2>
              <span className="text-xs text-gray-600">últimas {NUM_WEEKS} semanas · {scopeRestaurantId === 'todos' ? 'todos los restaurantes' : restaurants.find(r => r.id === scopeRestaurantId)?.name}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={evolutionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="licinioEuroGradient" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="euros" stroke="#1B4332" strokeWidth={2} fill="url(#licinioEuroGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Productos más pedidos */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-black mb-3">Productos más pedidos</h2>
            {topProductsDashboard.length === 0 ? (
              <p className="text-center py-10 text-gray-600 text-sm">Sin datos todavía</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, topProductsDashboard.length * 34)}>
                <BarChart data={topProductsDashboard} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0ee" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1C1C1E' }} axisLine={false} tickLine={false} width={160} />
                  <Tooltip
                    formatter={((value: any, _name: any, props: any) => [`${value} ${unitLabel(props?.payload?.unit ?? '')}`, 'Cantidad']) as any}
                    contentStyle={{ borderRadius: 10, border: '1px solid #eee', fontSize: 12 }}
                  />
                  <Bar dataKey="cantidad" radius={[0, 6, 6, 0]}>
                    {topProductsDashboard.map((_, i) => <Cell key={i} fill={BARS[i % BARS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  )
}
