'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ClipboardList, PackageX, TrendingDown, TrendingUp, Info, Boxes } from 'lucide-react'
import type { OrgCostItem } from '@/app/actions/orgCosts'
import { analyzeNave, contributionRatio, daysInMonth, eur, linesInRange, monthLabel, monthRange, netOfIva, pct, type FinLine } from '@/lib/finance'
import { cn } from '@/lib/utils'

type Props = {
  lines: FinLine[]
  restaurants: { id: string; name: string }[]
  naveFixedMonthly: number
  naveItems: OrgCostItem[]
  pendingOrders: number
  stockAlerts: { out: number; low: number }
  onGoTab: (tab: 'puntomuerto' | 'rentabilidad' | 'finanzas') => void
}

function delta(cur: number | null, prev: number | null) {
  if (cur == null || prev == null || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

export function SituacionTab({ lines, restaurants, naveFixedMonthly, naveItems, pendingOrders, stockAlerts, onGoTab }: Props) {
  const now = new Date()
  const ratio = useMemo(() => contributionRatio(lines), [lines])
  const cur = useMemo(() => analyzeNave({ lines, range: monthRange(now.getFullYear(), now.getMonth()), naveFixedMonthly, naveItems, ratio }), [lines, naveFixedMonthly, naveItems, ratio]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => analyzeNave({ lines, range: monthRange(now.getFullYear(), now.getMonth() - 1), naveFixedMonthly, naveItems, ratio }), [lines, naveFixedMonthly, naveItems, ratio]) // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = now.getDate()
  const total = daysInMonth(now.getFullYear(), now.getMonth())
  const projRevenue = elapsed > 0 ? (cur.revenueNet / elapsed) * total : cur.revenueNet
  const projProfit = cur.perEuro != null ? projRevenue * cur.perEuro - cur.lump : null

  const topRestaurants = useMemo(() => {
    const r = monthRange(now.getFullYear(), now.getMonth())
    const inMonth = linesInRange(lines, r)
    const byRest = new Map<string, number>()
    for (const l of inMonth) byRest.set(l.restaurant_id, (byRest.get(l.restaurant_id) ?? 0) + netOfIva(l))
    const sum = [...byRest.values()].reduce((s, v) => s + v, 0) || 1
    return restaurants
      .map(x => ({ ...x, amount: byRest.get(x.id) ?? 0, share: ((byRest.get(x.id) ?? 0) / sum) * 100 }))
      .sort((a, b) => b.amount - a.amount)
  }, [lines, restaurants]) // eslint-disable-line react-hooks/exhaustive-deps

  const noCost = ratio == null
  let tone: 'ok' | 'warn' | 'bad' | 'info' = 'info'
  let headline = ''
  let detail = ''
  if (noCost) {
    headline = 'Faltan datos para calcular el beneficio'
    detail = 'Registra el coste de tus productos (en Productos) para ver beneficio y punto muerto.'
  } else if (cur.revenueNet === 0) {
    headline = 'Este mes aún no hay ventas'
    detail = 'En cuanto entren pedidos de los restaurantes verás aquí cómo va el mes.'
  } else if (projProfit != null) {
    // A mitad de mes los ingresos son parciales pero los costes fijos son los del
    // mes entero: por eso el titular se basa en cómo CERRARÁ el mes al ritmo actual.
    if (projProfit >= 0) {
      tone = 'ok'
      headline = 'Vas camino de cerrar el mes en beneficio'
      detail = `Llevas ${eur(cur.revenueNet)} (día ${elapsed} de ${total}). Al ritmo de ahora cerrarás con ${eur(projRevenue)} de ingresos y unos ${eur(projProfit)} de beneficio.`
    } else {
      tone = projRevenue >= (cur.breakEvenNet ?? Infinity) * 0.9 ? 'warn' : 'bad'
      headline = 'A este ritmo cerrarás el mes en pérdidas'
      detail = `Llevas ${eur(cur.revenueNet)} (día ${elapsed} de ${total}) y al ritmo de ahora cerrarás con ${eur(projRevenue)}. Para cubrir todos los costes necesitas ${eur(cur.breakEvenNet)}: te faltan ${eur(cur.missingToBreakEven)} de ventas.`
    }
  }
  const toneCls = { ok: 'bg-green-50 border-green-200 text-green-900', warn: 'bg-amber-50 border-amber-200 text-amber-900', bad: 'bg-red-50 border-red-200 text-red-900', info: 'bg-blue-50 border-blue-200 text-blue-900' }[tone]
  const ToneIcon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? Info : tone === 'warn' ? AlertTriangle : TrendingDown

  const dRev = delta(cur.revenueNet, prev.revenueNet)
  const dProfit = delta(cur.profit, prev.profit)
  const DeltaBadge = ({ d }: { d: number | null }) => d == null ? null : (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', d >= 0 ? 'text-green-600' : 'text-red-500')}>
      {d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{Math.abs(d).toFixed(0)}%
    </span>
  )

  return (
    <div className="space-y-4">
      <div className={cn('rounded-2xl border p-5 flex items-start gap-3', toneCls)}>
        <ToneIcon className="w-8 h-8 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Situación de la nave · {monthLabel(now.getFullYear(), now.getMonth())} (día {elapsed} de {total})</p>
          <p className="text-xl sm:text-2xl font-bold mt-0.5">{headline}</p>
          <p className="text-sm mt-1.5 opacity-90">{detail}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-600">Ingresos del mes</p>
          <p className="text-2xl font-bold text-black mt-0.5">{eur(cur.revenueNet)}</p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">ventas a restaurantes · <DeltaBadge d={dRev} /> {dRev != null && 'vs mes pasado'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-600">Costes del mes</p>
          <p className="text-2xl font-bold text-black mt-0.5">{eur(cur.totalCosts)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">producto + variables + fijos del mes entero</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-600">Beneficio del mes</p>
          <p className={cn('text-2xl font-bold mt-0.5', (cur.profit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')}>{eur(cur.profit)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{projProfit != null ? `previsión a fin de mes: ${eur(projProfit)}` : ''}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-600">Punto muerto del mes</p>
          <p className="text-2xl font-bold text-black mt-0.5">{eur(cur.breakEvenNet)}</p>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-2">
            <div className={cn('h-full rounded-full', (cur.pctToBreakEven ?? 0) >= 100 ? 'bg-green-500' : (cur.pctToBreakEven ?? 0) >= 80 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${Math.min(100, cur.pctToBreakEven ?? 0)}%` }} />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{cur.pctToBreakEven != null ? `cubierto al ${pct(cur.pctToBreakEven)}` : 'sin calcular'}</p>
        </div>
      </div>

      {/* Qué requiere atención */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/pedidos" className={cn('rounded-2xl border p-4 flex items-center gap-3 hover:shadow-sm transition-shadow', pendingOrders > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100')}>
          <ClipboardList className={cn('w-8 h-8 shrink-0', pendingOrders > 0 ? 'text-yellow-600' : 'text-gray-400')} />
          <div>
            <p className="text-2xl font-bold text-black leading-none">{pendingOrders}</p>
            <p className="text-sm text-gray-700 mt-1">pedido{pendingOrders !== 1 ? 's' : ''} por preparar o enviar</p>
          </div>
        </Link>
        <Link href="/inventario" className={cn('rounded-2xl border p-4 flex items-center gap-3 hover:shadow-sm transition-shadow', stockAlerts.out > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100')}>
          <PackageX className={cn('w-8 h-8 shrink-0', stockAlerts.out > 0 ? 'text-red-500' : 'text-gray-400')} />
          <div>
            <p className="text-2xl font-bold text-black leading-none">{stockAlerts.out}</p>
            <p className="text-sm text-gray-700 mt-1">producto{stockAlerts.out !== 1 ? 's' : ''} sin stock</p>
          </div>
        </Link>
        <Link href="/inventario" className={cn('rounded-2xl border p-4 flex items-center gap-3 hover:shadow-sm transition-shadow', stockAlerts.low > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100')}>
          <Boxes className={cn('w-8 h-8 shrink-0', stockAlerts.low > 0 ? 'text-orange-500' : 'text-gray-400')} />
          <div>
            <p className="text-2xl font-bold text-black leading-none">{stockAlerts.low}</p>
            <p className="text-sm text-gray-700 mt-1">producto{stockAlerts.low !== 1 ? 's' : ''} con stock bajo</p>
          </div>
        </Link>
      </div>

      {/* Quién compra */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm font-semibold text-black">Quién te compra este mes</p>
          <p className="text-xs text-gray-600">ingreso para la nave, sin IVA</p>
        </div>
        <div className="space-y-2.5">
          {topRestaurants.map(r => (
            <div key={r.id}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-black">{r.name}</span>
                <span className="text-gray-700 tabular-nums">{eur(r.amount)} <span className="text-xs text-gray-500">· {pct(r.share)}</span></span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1">
                <div className="h-full bg-[#2D6A4F] rounded-full" style={{ width: `${r.share}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accesos */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onGoTab('puntomuerto')} className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#1E2B28] text-white hover:bg-[#141F1C]">Ver punto muerto mes a mes</button>
        <button onClick={() => onGoTab('rentabilidad')} className="text-sm font-semibold px-4 py-2.5 rounded-xl border-2 border-[#1E2B28] text-[#1E2B28] hover:bg-green-50">Rentabilidad de los restaurantes</button>
        <button onClick={() => onGoTab('finanzas')} className="text-sm font-semibold px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50">Costes fijos de la nave</button>
      </div>
    </div>
  )
}
