'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Info, Store } from 'lucide-react'
import { PeriodPicker, periodLabel, periodRange, type FinPeriod } from '@/components/stats/PeriodPicker'
import { CostItemsEditor } from '@/components/stats/CostItemsEditor'
import { upsertRestaurantSales, type OrgCostItem } from '@/app/actions/orgCosts'
import { analyzeRestaurant, eur, monthLabel, pct, ymKey, type FinLine, type MonthlySale, type Range } from '@/lib/finance'
import { cn } from '@/lib/utils'

type Restaurant = { id: string; name: string }

type Props = {
  lines: FinLine[]
  restaurants: Restaurant[]
  monthlySales: MonthlySale[]
  costItems: OrgCostItem[]
  period: FinPeriod
  onPeriod: (p: FinPeriod) => void
  onSalesChange: (next: MonthlySale[]) => void
  onItemsChange: (items: OrgCostItem[]) => void
}

function monthsOf(r: Range): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const cur = new Date(r.from.getFullYear(), r.from.getMonth(), 1)
  while (cur < r.to && out.length < 24) {
    out.push({ key: ymKey(cur), label: monthLabel(cur.getFullYear(), cur.getMonth()) })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

function SalesInputs({
  restaurantId, range, monthlySales, onSalesChange,
}: { restaurantId: string; range: Range; monthlySales: MonthlySale[]; onSalesChange: (next: MonthlySale[]) => void }) {
  const months = monthsOf(range)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = (key: string) => monthlySales.find(s => s.organization_id === restaurantId && s.month.slice(0, 7) === key)?.amount

  async function commit(key: string) {
    const raw = drafts[key]
    if (raw === undefined) return
    const amount = Number(raw.replace(',', '.')) || 0
    if (amount === (current(key) ?? 0)) { setDrafts(d => { const n = { ...d }; delete n[key]; return n }); return }
    setError(null)
    try {
      await upsertRestaurantSales(restaurantId, key, amount)
      const rest = monthlySales.filter(s => !(s.organization_id === restaurantId && s.month.slice(0, 7) === key))
      onSalesChange(amount > 0 ? [...rest, { organization_id: restaurantId, month: `${key}-01`, amount }] : rest)
      setDrafts(d => { const n = { ...d }; delete n[key]; return n })
      setSaved(key)
      setTimeout(() => setSaved(null), 1800)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar')
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-black">Ventas del restaurante (lo que factura, sin IVA)</p>
      <p className="text-xs text-gray-600">Escribe lo que ha vendido cada mes y pulsa Intro o sal del campo para guardar.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {months.map(m => (
          <label key={m.key} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <span className="text-sm text-gray-700 flex-1">{m.label}</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={drafts[m.key] ?? (current(m.key) != null ? String(current(m.key)) : '')}
              onChange={e => setDrafts(d => ({ ...d, [m.key]: e.target.value }))}
              onBlur={() => commit(m.key)}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1E2B28]"
            />
            <span className="text-sm text-gray-600">€</span>
            {saved === m.key && <span className="text-xs text-green-600 font-medium">✓</span>}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function RentabilidadTab({ lines, restaurants, monthlySales, costItems, period, onPeriod, onSalesChange, onItemsChange }: Props) {
  const range = useMemo(() => periodRange(period), [period])
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => restaurants.map(r => ({
    r, a: analyzeRestaurant({ lines, range, restaurantId: r.id, sales: monthlySales, items: costItems }),
  })).sort((x, y) => y.a.purchasesNet - x.a.purchasesNet), [restaurants, lines, range, monthlySales, costItems])

  const totalPurchases = rows.reduce((s, x) => s + x.a.purchasesNet, 0)
  const withSales = rows.filter(x => x.a.sales != null)
  const totalSales = withSales.reduce((s, x) => s + (x.a.sales ?? 0), 0)
  const totalProfit = withSales.reduce((s, x) => s + (x.a.profit ?? 0), 0)

  return (
    <div className="space-y-4">
      <PeriodPicker value={period} onChange={onPeriod} />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 text-sm text-blue-900">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          Lo que un restaurante <strong>compra a la nave</strong> es <strong>gasto para el restaurante</strong> y a la vez <strong>ingreso para la nave</strong>. Aquí se ve el lado del restaurante:
          lo que gasta en la nave frente a lo que vende y a sus propios costes, para sacar su beneficio y rentabilidad.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
          <p className="text-xs text-gray-600">Gasto de los restaurantes en la nave</p>
          <p className="text-2xl font-bold text-black mt-0.5">{eur(totalPurchases)}</p>
          <p className="text-[11px] text-gray-500">{periodLabel(period)} · sin IVA · es ingreso para la nave</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
          <p className="text-xs text-gray-600">Ventas de los restaurantes</p>
          <p className="text-2xl font-bold text-black mt-0.5">{withSales.length > 0 ? eur(totalSales) : '—'}</p>
          <p className="text-[11px] text-gray-500">{withSales.length} de {rows.length} restaurantes con ventas introducidas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
          <p className="text-xs text-gray-600">Beneficio de los restaurantes</p>
          <p className={cn('text-2xl font-bold mt-0.5', withSales.length === 0 ? 'text-black' : totalProfit >= 0 ? 'text-green-700' : 'text-red-600')}>
            {withSales.length > 0 ? eur(totalProfit) : '—'}
          </p>
          <p className="text-[11px] text-gray-500">solo los que tienen ventas</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(({ r, a }) => {
          const open = openId === r.id
          const profitTone = a.profit == null ? 'text-gray-500' : a.profit >= 0 ? 'text-green-700' : 'text-red-600'
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E2B28]/[0.06] flex items-center justify-center shrink-0"><Store className="w-5 h-5 text-[#1E2B28]" /></div>
                  <p className="font-bold text-black text-base flex-1">{r.name}</p>
                  {a.profitPct != null ? (
                    <span className={cn('text-sm font-bold px-3 py-1.5 rounded-full', a.profitPct >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
                      Rentabilidad {pct(a.profitPct, 1)}
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">Sin ventas</span>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Gasto en la nave</p>
                    <p className="text-base font-bold text-black">{eur(a.purchasesNet)}</p>
                    {a.naveShare != null && <p className="text-[11px] text-gray-500">{pct(a.naveShare, 1)} de sus ventas</p>}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ventas</p>
                    <p className="text-base font-bold text-black">{a.sales != null ? eur(a.sales) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Costes variables</p>
                    <p className="text-base font-bold text-black">{eur(a.otherVariable)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Costes fijos</p>
                    <p className="text-base font-bold text-black">{eur(a.fixed)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Beneficio</p>
                    <p className={cn('text-base font-bold', profitTone)}>{a.profit != null ? eur(a.profit) : '—'}</p>
                    {a.breakEvenSales != null && <p className="text-[11px] text-gray-500">Punto muerto: {eur(a.breakEvenSales)}</p>}
                  </div>
                </div>

                {a.sales == null && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                    Falta introducir las ventas de este periodo para calcular su beneficio y rentabilidad.
                  </p>
                )}
                {a.salesMonthsWithData > 0 && a.salesMonthsTotal - a.salesMonthsWithData > 0.05 && (
                  <p className="text-xs text-gray-600 mt-2">Ojo: solo hay ventas introducidas para parte de los meses del periodo.</p>
                )}
              </div>

              <button
                onClick={() => setOpenId(open ? null : r.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100 text-sm font-semibold text-[#1E2B28] hover:bg-gray-50"
              >
                {open ? 'Cerrar' : 'Introducir ventas y costes de este restaurante'}
                <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
              </button>

              {open && (
                <div className="p-4 border-t border-gray-100 space-y-5 bg-gray-50/40">
                  <SalesInputs restaurantId={r.id} range={range} monthlySales={monthlySales} onSalesChange={onSalesChange} />
                  <CostItemsEditor organizationId={r.id} items={costItems} allowedKinds={['fijo', 'variable']} onItemsChange={onItemsChange} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
