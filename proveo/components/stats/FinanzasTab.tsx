'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown } from 'lucide-react'
import type { FixedCost, FixedCostCategory } from '@/app/actions/fixedCosts'

const CATEGORY_LABEL: Record<FixedCostCategory, string> = {
  personal: 'Personal',
  suministros: 'Suministros',
  alquiler: 'Alquiler',
  prestamos: 'Préstamos',
  seguros: 'Seguros',
  otros: 'Otros',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL) as FixedCostCategory[]

export type FinanceData = {
  contributionPct: number | null
  coveragePct: number | null
  fixedCostsTotal: number
  breakEvenRevenue: number | null
  monthRevenue: number
  monthNetRevenue: number
  monthCOGS: number | null
  monthContribution: number | null
  profitLoss: number | null
  pctToBreakEven: number | null
  dailyBreakEven: number | null
  safetyMarginPct: number | null
  daysToBreakEven: number | null
  projectedNetRevenue: number
  projectedProfitLoss: number | null
  daysElapsed: number
  daysInMonth: number
  monthLabel: string
}

type Props = {
  fixedCosts: FixedCost[]
  financeData: FinanceData
  onCreate: (input: { category: FixedCostCategory; name: string; monthly_amount: number }) => Promise<void>
  onUpdate: (id: string, input: { category: FixedCostCategory; name: string; monthly_amount: number }) => Promise<void>
  onToggle: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function FinanzasTab({ fixedCosts, financeData: f, onCreate, onUpdate, onToggle, onDelete }: Props) {
  const [newCategory, setNewCategory] = useState<FixedCostCategory>('personal')
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<FixedCostCategory>('personal')
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')

  async function handleAdd() {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ category: newCategory, name: newName.trim(), monthly_amount: Number(newAmount) || 0 })
      setNewName(''); setNewAmount('')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(c: FixedCost) {
    setEditingId(c.id); setEditCategory(c.category); setEditName(c.name); setEditAmount(String(c.monthly_amount))
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    await onUpdate(id, { category: editCategory, name: editName.trim(), monthly_amount: Number(editAmount) || 0 })
    setEditingId(null)
  }

  const grouped = CATEGORIES.map(cat => ({
    cat, items: fixedCosts.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-4">
      {/* Costes fijos ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-black">Costes fijos mensuales</h2>
            <p className="text-xs text-gray-600 mt-0.5">Personal, suministros, alquiler, préstamos... lo que pagas cada mes independientemente de lo que factures</p>
          </div>
          <p className="text-lg font-bold text-black shrink-0">{f.fixedCostsTotal.toFixed(0)}€/mes</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50/60 border-b border-gray-100">
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value as FixedCostCategory)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-[#1E2B28]"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Ej. Nómina cocina"
            className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E2B28]"
          />
          <input
            type="number"
            value={newAmount}
            onChange={e => setNewAmount(e.target.value)}
            placeholder="€/mes"
            className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E2B28]"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1E2B28] text-white hover:bg-[#141F1C] transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>
        </div>

        {grouped.length === 0 ? (
          <p className="text-center py-10 text-gray-600 text-sm">Todavía no has añadido ningún coste fijo</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {grouped.map(g => (
              <div key={g.cat}>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  {CATEGORY_LABEL[g.cat]} · {g.items.filter(i => i.active).reduce((s, i) => s + i.monthly_amount, 0).toFixed(0)}€/mes
                </p>
                {g.items.map(c => (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${!c.active ? 'opacity-40' : ''}`}>
                    {editingId === c.id ? (
                      <>
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value as FixedCostCategory)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white"
                        >
                          {CATEGORIES.map(cc => <option key={cc} value={cc}>{CATEGORY_LABEL[cc]}</option>)}
                        </select>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                        />
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm"
                        />
                        <button onClick={() => saveEdit(c.id)} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 hover:bg-gray-100 p-1.5 rounded-lg"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 truncate font-medium text-black">{c.name}</span>
                        <span className="font-semibold text-black shrink-0">{c.monthly_amount.toFixed(0)}€</span>
                        <button
                          onClick={() => onToggle(c.id, !c.active)}
                          className={`text-[11px] font-medium px-2 py-1 rounded-full shrink-0 ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {c.active ? 'Activo' : 'Inactivo'}
                        </button>
                        <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-black p-1.5 rounded-lg shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onDelete(c.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Punto muerto ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-black mb-3">Punto muerto</h2>
          {f.contributionPct == null ? (
            <p className="text-sm text-gray-600">Sin productos con coste registrado suficiente para calcularlo.</p>
          ) : f.fixedCostsTotal === 0 ? (
            <p className="text-sm text-gray-600">Añade tus costes fijos para calcular cuánto necesitas facturar para cubrirlos.</p>
          ) : (
            <>
              <p className="text-xl font-bold text-black">{f.breakEvenRevenue?.toFixed(0)}€/mes</p>
              <p className="text-xs text-gray-600 mt-1">
                Facturación necesaria para cubrir costes fijos y variables, con un margen de contribución del {f.contributionPct.toFixed(0)}%
              </p>
              {f.coveragePct != null && (
                <p className={`text-[11px] mt-1.5 ${f.coveragePct < 70 ? 'text-amber-600' : 'text-gray-500'}`}>
                  Calculado sobre productos con coste registrado, que cubren el {f.coveragePct.toFixed(0)}% de la facturación de este mes
                  {f.coveragePct < 70 ? ' — con poca cobertura, tómalo como orientativo' : ''}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">Por día</p>
                  <p className="text-sm font-semibold text-black">{f.dailyBreakEven?.toFixed(0)}€</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">Días para cubrirlo</p>
                  <p className="text-sm font-semibold text-black">{f.daysToBreakEven != null ? `~${Math.ceil(f.daysToBreakEven)} días` : '—'}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-black capitalize mb-2">Progreso de {f.monthLabel}</h2>
          {f.pctToBreakEven == null ? (
            <p className="text-sm text-gray-600">Configura costes fijos y margen para ver el progreso.</p>
          ) : (
            <>
              <div className="flex items-end justify-between mb-1.5">
                <p className="text-xl font-bold text-black">{f.monthRevenue.toFixed(0)}€</p>
                <p className="text-xs text-gray-600">{f.pctToBreakEven.toFixed(0)}% del punto muerto</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.pctToBreakEven >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(Math.max(f.pctToBreakEven, 2), 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Día {f.daysElapsed} de {f.daysInMonth} · {f.pctToBreakEven >= 100 ? 'ya has cubierto el punto muerto' : 'todavía por debajo del punto muerto'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Cuenta de resultados + proyección ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-black capitalize mb-3">Cuenta de resultados de {f.monthLabel} (hasta hoy)</h2>
          {f.profitLoss == null ? (
            <p className="text-sm text-gray-600">Sin margen de contribución calculable todavía.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Ingresos (netos de IVA)</span><span className="font-medium text-black">{f.monthNetRevenue.toFixed(0)}€</span></div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  − Coste variable estimado
                  {f.coveragePct != null && <span className="text-gray-400"> ({f.coveragePct.toFixed(0)}% cobertura)</span>}
                </span>
                <span className="font-medium text-black">{f.monthCOGS?.toFixed(0)}€</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-600">= Margen de contribución</span><span className="font-medium text-black">{f.monthContribution?.toFixed(0)}€</span></div>
              <div className="flex justify-between"><span className="text-gray-600">− Costes fijos</span><span className="font-medium text-black">{f.fixedCostsTotal.toFixed(0)}€</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base">
                <span className="font-semibold text-black">{f.profitLoss >= 0 ? 'Beneficio' : 'Pérdida'}</span>
                <span className={`font-bold ${f.profitLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>{f.profitLoss.toFixed(0)}€</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-black mb-3">Proyección a fin de mes</h2>
          {f.projectedProfitLoss == null ? (
            <p className="text-sm text-gray-600">Sin datos suficientes todavía.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {f.projectedProfitLoss >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                <p className={`text-xl font-bold ${f.projectedProfitLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {f.projectedProfitLoss >= 0 ? '+' : ''}{f.projectedProfitLoss.toFixed(0)}€
                </p>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Si el ritmo de venta se mantiene, facturando ≈{f.projectedNetRevenue.toFixed(0)}€ netos hasta fin de mes
              </p>
              {f.safetyMarginPct != null && (
                <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
                  Margen de seguridad: <span className={`font-semibold ${f.safetyMarginPct >= 0 ? 'text-black' : 'text-red-500'}`}>{f.safetyMarginPct.toFixed(0)}%</span>
                  {' '}— la facturación proyectada podría caer eso antes de entrar en pérdidas
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
