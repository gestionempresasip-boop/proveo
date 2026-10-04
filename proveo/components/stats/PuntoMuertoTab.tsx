'use client'

import { useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts'
import { AlertTriangle, CheckCircle2, TrendingDown, Info } from 'lucide-react'
import { PeriodPicker, periodLabel, periodRange, isCurrentMonth, type FinPeriod } from '@/components/stats/PeriodPicker'
import { CostItemsEditor } from '@/components/stats/CostItemsEditor'
import type { OrgCostItem } from '@/app/actions/orgCosts'
import { analyzeNave, contributionRatio, dailyCumulative, daysInMonth, eur, monthLabel, monthRange, pct, type FinLine } from '@/lib/finance'
import { cn } from '@/lib/utils'

type Props = {
  lines: FinLine[]
  naveFixedMonthly: number
  naveItems: OrgCostItem[]
  naveOrgId: string | null
  period: FinPeriod
  onPeriod: (p: FinPeriod) => void
  onEditFixed: () => void
  onItemsChange: (items: OrgCostItem[]) => void
}

const chartTip = { borderRadius: 10, border: '1px solid #eee', fontSize: 12 }

export function PuntoMuertoTab({ lines, naveFixedMonthly, naveItems, naveOrgId, period, onPeriod, onEditFixed, onItemsChange }: Props) {
  const ratio = useMemo(() => contributionRatio(lines), [lines])
  const range = useMemo(() => periodRange(period), [period])
  const a = useMemo(() => analyzeNave({ lines, range, naveFixedMonthly, naveItems, ratio }), [lines, range, naveFixedMonthly, naveItems, ratio])
  const curve = useMemo(() => dailyCumulative(lines, range), [lines, range])

  const history = useMemo(() => {
    const now = new Date()
    const out: { key: string; label: string; year: number; month: number; ingresos: number; costes: number; beneficio: number; puntoMuerto: number | null; cubierto: number | null }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const r = monthRange(d.getFullYear(), d.getMonth())
      const m = analyzeNave({ lines, range: r, naveFixedMonthly, naveItems, ratio })
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') + (d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''),
        year: d.getFullYear(), month: d.getMonth(),
        ingresos: Math.round(m.revenueNet),
        costes: Math.round(m.totalCosts ?? 0),
        beneficio: Math.round(m.profit ?? 0),
        puntoMuerto: m.breakEvenNet != null ? Math.round(m.breakEvenNet) : null,
        cubierto: m.pctToBreakEven,
      })
    }
    return out
  }, [lines, naveFixedMonthly, naveItems, ratio])

  // Proyección a fin de mes (solo si estamos mirando el mes en curso)
  const projection = useMemo(() => {
    if (!isCurrentMonth(period)) return null
    const now = new Date()
    const elapsed = now.getDate()
    const total = daysInMonth(now.getFullYear(), now.getMonth())
    const projRevenue = elapsed > 0 ? (a.revenueNet / elapsed) * total : a.revenueNet
    const projProfit = a.perEuro != null ? projRevenue * a.perEuro - a.lump : null
    return { elapsed, total, projRevenue, projProfit }
  }, [period, a])

  // Simulador
  const sliderMax = Math.max(1000, Math.round(Math.max((a.breakEvenNet ?? 0) * 2, a.revenueNet * 1.6) / 1000) * 1000)
  const [sim, setSim] = useState<number | null>(null)
  const simRevenue = sim ?? Math.round(a.breakEvenNet ?? a.revenueNet)
  const simProfit = a.perEuro != null ? simRevenue * a.perEuro - a.lump : null

  const pctBar = a.pctToBreakEven ?? 0
  const noCost = ratio == null
  const noSales = a.revenueNet === 0

  let tone: 'ok' | 'warn' | 'bad' | 'info' = 'info'
  let headline = ''
  let sub = ''
  if (noCost) {
    tone = 'info'; headline = 'No puedo calcular el beneficio todavía'
    sub = 'Faltan costes de producto: añádelos en Productos (campo Coste) para que se pueda calcular el margen.'
  } else if (noSales) {
    tone = 'info'; headline = `Sin ventas en ${periodLabel(period)}`; sub = 'No hay pedidos de restaurantes en este periodo.'
  } else if ((a.profit ?? 0) >= 0) {
    tone = 'ok'; headline = `En beneficio: ${eur(a.profit)}`
    sub = `Has vendido ${eur(a.revenueNet)} y el punto muerto era ${eur(a.breakEvenNet)}. Cubres todos los costes y te sobran ${eur(a.profit)}.`
  } else {
    tone = pctBar >= 80 ? 'warn' : 'bad'; headline = `En pérdidas: ${eur(a.profit)}`
    sub = `Para cubrir costes necesitas vender ${eur(a.breakEvenNet)}; llevas ${eur(a.revenueNet)}. Te faltan ${eur(a.missingToBreakEven)}.`
  }
  // Mes en curso: los ingresos son parciales pero los costes fijos son los del
  // mes entero, así que el titular se basa en cómo CERRARÁ el mes al ritmo actual.
  if (projection && projection.projProfit != null && !noSales && !noCost) {
    const pm = projection
    if (pm.projProfit! >= 0) {
      tone = 'ok'
      headline = 'Vas camino de cerrar el mes en beneficio'
      sub = `Llevas ${eur(a.revenueNet)} (día ${pm.elapsed} de ${pm.total}). Al ritmo de ahora cerrarás con unos ${eur(pm.projRevenue)} de ingresos y ${eur(pm.projProfit)} de beneficio. El punto muerto está en ${eur(a.breakEvenNet)}.`
    } else {
      tone = pm.projRevenue >= (a.breakEvenNet ?? Infinity) * 0.9 ? 'warn' : 'bad'
      headline = 'A este ritmo cerrarás el mes en pérdidas'
      sub = `Llevas ${eur(a.revenueNet)} (día ${pm.elapsed} de ${pm.total}) y cerrarás con unos ${eur(pm.projRevenue)}. Para cubrir todos los costes necesitas ${eur(a.breakEvenNet)}: te faltan ${eur(a.missingToBreakEven)} de ventas.`
    }
  }
  const toneCls = {
    ok: 'bg-green-50 border-green-200 text-green-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    bad: 'bg-red-50 border-red-200 text-red-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  }[tone]
  const ToneIcon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? Info : tone === 'warn' ? AlertTriangle : TrendingDown

  const total = a.revenueNet || 1
  const rows = [
    { label: 'Coste de producto', value: a.cogs ?? 0, color: 'bg-[#1E2B28]' },
    { label: 'Otros costes variables', value: a.otherVariable, color: 'bg-blue-500' },
    { label: 'Costes fijos', value: a.fixed, color: 'bg-amber-500' },
    (a.profit ?? 0) >= 0
      ? { label: 'Beneficio', value: a.profit ?? 0, color: 'bg-green-500' }
      : { label: 'Pérdida', value: -(a.profit ?? 0), color: 'bg-red-500' },
  ]

  return (
    <div className="space-y-4">
      <PeriodPicker value={period} onChange={p => { setSim(null); onPeriod(p) }} />

      {/* Situación en una frase */}
      <div className={cn('rounded-2xl border p-5 flex items-start gap-3', toneCls)}>
        <ToneIcon className="w-7 h-7 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{periodLabel(period)}</p>
          <p className="text-xl sm:text-2xl font-bold mt-0.5">{headline}</p>
          <p className="text-sm mt-1.5 opacity-90">{sub}</p>
        </div>
      </div>

      {/* Cifras clave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos (ventas a restaurantes)', value: eur(a.revenueNet), hint: 'sin IVA' },
          { label: 'Costes totales', value: eur(a.totalCosts), hint: 'producto + variables + fijos' },
          { label: 'Beneficio', value: eur(a.profit), hint: projection?.projProfit != null ? `previsión a fin de mes: ${eur(projection.projProfit)}` : a.profitPct != null ? `${pct(a.profitPct, 1)} de los ingresos` : '', tone: (a.profit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: 'Punto muerto', value: eur(a.breakEvenNet), hint: a.pctToBreakEven != null ? `llevas el ${pct(a.pctToBreakEven)}` : '' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
            <p className="text-xs text-gray-600">{k.label}</p>
            <p className={cn('text-xl sm:text-2xl font-bold mt-0.5', (k as any).tone ?? 'text-black')}>{k.value}</p>
            {k.hint && <p className="text-[11px] text-gray-500 mt-0.5">{k.hint}</p>}
          </div>
        ))}
      </div>

      {/* Barra de progreso al punto muerto */}
      {a.breakEvenNet != null && !noSales && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-semibold text-black">Camino al punto muerto</p>
            <p className="text-sm text-gray-700">{eur(a.revenueNet)} de {eur(a.breakEvenNet)}</p>
          </div>
          <div className="relative h-4 rounded-full bg-gray-100 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', pctBar >= 100 ? 'bg-green-500' : pctBar >= 80 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${Math.min(100, pctBar)}%` }} />
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {pctBar >= 100 ? `Superado: ${eur(a.revenueNet - a.breakEvenNet)} por encima del punto muerto.` : `Faltan ${eur(a.missingToBreakEven)} para cubrir todos los costes.`}
          </p>
        </div>
      )}

      {/* Dónde se va el dinero */}
      {!noCost && !noSales && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-black mb-3">¿Dónde se va cada euro que ingresas?</p>
          <div className="flex h-5 rounded-full overflow-hidden mb-3">
            {rows.map(r => <div key={r.label} className={r.color} style={{ width: `${Math.max(0, (r.value / total) * 100)}%` }} title={r.label} />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {rows.map(r => (
              <div key={r.label} className="flex items-start gap-2">
                <span className={cn('w-3 h-3 rounded-full mt-1 shrink-0', r.color)} />
                <div>
                  <p className="text-xs text-gray-600">{r.label}</p>
                  <p className="text-sm font-bold text-black">{eur(r.value)}</p>
                  <p className="text-[11px] text-gray-500">{pct((r.value / total) * 100, 1)} de los ingresos</p>
                </div>
              </div>
            ))}
          </div>
          {a.coveragePct != null && a.coveragePct < 80 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
              Solo el {pct(a.coveragePct)} de lo vendido tiene el coste del producto registrado; el beneficio es una estimación. Completa los costes en Productos para afinarlo.
            </p>
          )}
        </div>
      )}

      {/* Curva diaria */}
      {!noSales && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-black">Ingresos acumulados día a día</p>
            <p className="text-xs text-gray-600">La línea roja es el punto muerto</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={curve} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="pmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1B4332" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1B4332" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0ee" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={((v: any) => [eur(Number(v)), 'Acumulado']) as any} contentStyle={chartTip} />
              {a.breakEvenNet != null && <ReferenceLine y={Math.round(a.breakEvenNet)} stroke="#DC2626" strokeDasharray="6 4" label={{ value: 'Punto muerto', position: 'insideTopLeft', fill: '#DC2626', fontSize: 11 }} />}
              <Area type="monotone" dataKey="cumulative" stroke="#1B4332" strokeWidth={2} fill="url(#pmGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mes a mes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-black">Mes a mes (últimos 12 meses)</p>
          <p className="text-xs text-gray-600">Toca una barra para ver ese mes</p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={history} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0ee" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              formatter={((v: any, name: any) => [eur(Number(v)), name === 'ingresos' ? 'Ingresos' : name === 'puntoMuerto' ? 'Punto muerto' : 'Beneficio']) as any}
              contentStyle={chartTip}
            />
            <Bar dataKey="ingresos" radius={[6, 6, 0, 0]} cursor="pointer" onClick={((d: any) => onPeriod({ ...period, mode: 'mes', year: d.year, month: d.month })) as any}>
              {history.map(h => (
                <Cell key={h.key} fill={period.mode === 'mes' && h.year === period.year && h.month === period.month ? '#A8793A' : '#2D6A4F'} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="puntoMuerto" stroke="#DC2626" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-gray-600 border-b border-gray-100">
                <th className="text-left py-2 font-medium">Mes</th>
                <th className="text-right py-2 font-medium">Ingresos</th>
                <th className="text-right py-2 font-medium">Costes</th>
                <th className="text-right py-2 font-medium">Beneficio</th>
                <th className="text-right py-2 font-medium">Punto muerto</th>
                <th className="text-right py-2 font-medium">Cubierto</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map(h => (
                <tr
                  key={h.key}
                  onClick={() => onPeriod({ ...period, mode: 'mes', year: h.year, month: h.month })}
                  className={cn('border-b border-gray-50 cursor-pointer hover:bg-gray-50', period.mode === 'mes' && h.year === period.year && h.month === period.month && 'bg-amber-50/60')}
                >
                  <td className="py-2 font-medium text-black">{monthLabel(h.year, h.month)}</td>
                  <td className="py-2 text-right tabular-nums">{eur(h.ingresos)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-700">{eur(h.costes)}</td>
                  <td className={cn('py-2 text-right tabular-nums font-semibold', h.beneficio >= 0 ? 'text-green-700' : 'text-red-600')}>{eur(h.beneficio)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-700">{eur(h.puntoMuerto)}</td>
                  <td className="py-2 text-right tabular-nums">{pct(h.cubierto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulador */}
      {a.perEuro != null && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-black">Simulador: ¿y si vendo...?</p>
          <p className="text-xs text-gray-600 mt-0.5">Mueve la barra y verás el beneficio con los costes de {periodLabel(period).toLowerCase()}.</p>
          <input
            type="range" min={0} max={sliderMax} step={100} value={simRevenue}
            onChange={e => setSim(Number(e.target.value))}
            className="w-full mt-4 accent-[#1E2B28]"
          />
          <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
            <div>
              <p className="text-xs text-gray-600">Ingresos simulados</p>
              <p className="text-2xl font-bold text-black">{eur(simRevenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Beneficio resultante</p>
              <p className={cn('text-2xl font-bold', (simProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')}>{eur(simProfit)}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {a.breakEvenNet != null && <button onClick={() => setSim(Math.round(a.breakEvenNet!))} className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300">Justo el punto muerto</button>}
            <button onClick={() => setSim(Math.round(a.revenueNet))} className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300">Lo que llevo vendido</button>
          </div>
        </div>
      )}

      {/* Costes de la nave */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-black">Costes de la nave que usa este cálculo</p>
            <p className="text-xs text-gray-600">Fijos: {eur(naveFixedMonthly)}/mes · el coste de producto sale del campo Coste de cada producto.</p>
          </div>
          <button onClick={onEditFixed} className="text-sm font-semibold px-4 py-2.5 rounded-xl border-2 border-[#1E2B28] text-[#1E2B28] hover:bg-green-50">
            Editar costes fijos
          </button>
        </div>
        {naveOrgId ? (
          <CostItemsEditor organizationId={naveOrgId} items={naveItems} allowedKinds={['variable']} onItemsChange={onItemsChange} />
        ) : (
          <p className="text-sm text-gray-600">No se encuentra la organización de la nave.</p>
        )}
      </div>
    </div>
  )
}
